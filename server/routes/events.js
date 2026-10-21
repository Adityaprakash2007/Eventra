import { Router } from "express";
import { Op } from "sequelize";
import { Event, Ticket, Registration, User, AgendaItem } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { organizerForEvent } from "../lib/notify.js";

const router = Router();

// Helper: transform DB event row into frontend-expected shape
function toFrontend(e, extra = {}) {
  const plain = e.get ? e.get({ plain: true }) : e;
  // Get price from first ticket if available, else 0
  const tickets = plain.tickets || [];
  const price = tickets.length > 0 ? Number(tickets[0].price) : 0;
  // "seats" = seats still AVAILABLE: live value from the ticket row when it
  // exists (it is decremented transactionally on booking), else capacity.
  const fromTicket = tickets.length > 0 ? Number(tickets[0].quantity_available) : NaN;
  const seats = Number.isFinite(fromTicket) && fromTicket >= 0 ? fromTicket : plain.capacity || 0;
  const capacity = plain.capacity || seats;

  return {
    id: plain.event_id,
    title: plain.title,
    venue: plain.venue || "",
    state: plain.state || null,
    city: plain.city || null,
    date: plain.start_date ? new Date(plain.start_date).toISOString().split("T")[0] : "",
    time: plain.start_date
      ? new Date(plain.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      : "",
    startDateTime: plain.start_date || null,
    endDateTime: plain.end_date || null,
    seats,
    capacity,
    registered: Math.max(0, capacity - seats),
    price,
    image: plain.image || null,
    description: plain.description,
    category: plain.category,
    status: plain.status,
    agenda: plain.agenda || null,
    venueLat: plain.venue_lat != null ? Number(plain.venue_lat) : null,
    venueLng: plain.venue_lng != null ? Number(plain.venue_lng) : null,
    organizerName: plain.organizer_name || null,
    organizerBio: plain.organizer_bio || null,
    ...extra,
  };
}

// GET /api/events — list events
// Optional filters: ?state=<state>&city=<city>&category=<category> — all matched
// case-insensitively (MySQL's default collation makes LIKE case-insensitive;
// the frontend normalizes to lowercase too). City alone would be ambiguous
// across states, so pass state along with city.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = {};

    const { state, city, category } = req.query;
    if (state && typeof state === "string") {
      where.state = { [Op.like]: state.trim() };
    }
    if (city && typeof city === "string") {
      where.city = { [Op.like]: city.trim() };
    }
    if (category && typeof category === "string" && category.trim()) {
      where.category = { [Op.like]: category.trim() };
    }

    const events = await Event.findAll({
      where,
      include: [
        { model: Ticket, as: "tickets", attributes: ["type", "price", "quantity_available"] },
        { model: Registration, as: "registrations", attributes: ["registration_id"], required: false },
      ],
      order: [["start_date", "ASC"]],
    });
    res.json(events.map((e) => toFrontend(e)));
  })
);

// GET /api/events/locations — distinct state/city pairs that actually have events
router.get(
  "/locations",
  asyncHandler(async (_req, res) => {
    const rows = await Event.findAll({
      attributes: ["state", "city"],
      where: {
        state: { [Op.not]: null },
        city: { [Op.not]: null },
      },
      group: ["state", "city"],
      order: [
        ["state", "ASC"],
        ["city", "ASC"],
      ],
    });

    const byState = {};
    for (const r of rows) {
      const st = r.getDataValue("state");
      const ct = r.getDataValue("city");
      if (!st || !ct) continue;
      (byState[st] ||= []).push(ct);
    }

    res.json(
      Object.entries(byState).map(([state, cities]) => ({ state, cities }))
    );
  })
);

// GET /api/events/:id — single event (rich detail: organizer, agenda, attendees count)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id, {
      include: [
        { model: Ticket, as: "tickets", attributes: ["type", "price", "quantity_available"] },
        { model: AgendaItem, as: "agendaItems" },
      ],
    });
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const [attendeeCount, organizer] = await Promise.all([
      Registration.count({ where: { event_id: event.event_id } }),
      organizerForEvent(event),
    ]);

    const agendaRows = (event.agendaItems || [])
      .sort((a, b) => (a.item_order ?? 0) - (b.item_order ?? 0))
      .map((a) => ({
        id: a.agenda_id,
        title: a.title,
        description: a.description,
        startTime: a.start_time,
        endTime: a.end_time,
        speaker: a.speaker,
      }));

    res.json(
      toFrontend(event, {
        organizer: organizer,
        attendeesCount: attendeeCount,
        agendaItems: agendaRows,
      })
    );
  })
);

// POST /api/events — create event (admin only)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, venue, date, seats, price } = req.body;
    if (!title || !venue || !date) {
      return res.status(400).json({ success: false, error: "title, venue, and date are required" });
    }
    const event = await Event.create({
      title,
      venue,
      state: req.body.state || null,
      city: req.body.city || null,
      description: req.body.description || "",
      start_date: new Date(date),
      end_date: new Date(date),
      category: req.body.category || "General",
      capacity: seats ?? 0,
      status: "Open",
      organizer_id: req.body.organizer_id || 1,
      image: req.body.image || null,
      agenda: req.body.agenda || null,
      venue_lat: req.body.venueLat ?? null,
      venue_lng: req.body.venueLng ?? null,
      organizer_name: req.body.organizerName || null,
      organizer_bio: req.body.organizerBio || null,
    });

    // Create a default ticket for this event
    if (price != null) {
      await Ticket.create({
        ticket_id: 1,
        event_id: event.event_id,
        type: "Regular",
        price: price || 0,
        quantity_available: seats ?? 0,
      });
    }

    // Optional structured agenda rows
    if (Array.isArray(req.body.agendaItems) && req.body.agendaItems.length) {
      await AgendaItem.bulkCreate(
        req.body.agendaItems.map((a, i) => ({
          event_id: event.event_id,
          title: String(a.title || `Session ${i + 1}`).slice(0, 255),
          description: a.description || null,
          start_time: a.startTime || null,
          end_time: a.endTime || null,
          speaker: a.speaker || null,
          item_order: i,
        }))
      );
    }

    const created = await Event.findByPk(event.event_id, {
      include: [{ model: Ticket, as: "tickets" }],
    });
    res.status(201).json(toFrontend(created));
  })
);

// PUT /api/events/:id — update event (admin only)
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const { title, venue, date, seats, price } = req.body;
    await event.update({
      ...(title && { title }),
      ...(venue && { venue }),
      ...(req.body.state !== undefined && { state: req.body.state || null }),
      ...(req.body.city !== undefined && { city: req.body.city || null }),
      ...(req.body.description !== undefined && { description: req.body.description }),
      ...(req.body.category !== undefined && { category: req.body.category }),
      ...(req.body.image !== undefined && { image: req.body.image }),
      ...(req.body.agenda !== undefined && { agenda: req.body.agenda }),
      ...(req.body.venueLat !== undefined && { venue_lat: req.body.venueLat }),
      ...(req.body.venueLng !== undefined && { venue_lng: req.body.venueLng }),
      ...(req.body.organizerName !== undefined && { organizer_name: req.body.organizerName }),
      ...(req.body.organizerBio !== undefined && { organizer_bio: req.body.organizerBio }),
      ...(date && { start_date: new Date(date), end_date: new Date(date) }),
      ...(seats != null && { capacity: seats }),
    });

    // Update ticket price if provided
    if (price != null) {
      await Ticket.update({ price }, { where: { event_id: event.event_id } });
    }

    const updated = await Event.findByPk(event.event_id, {
      include: [{ model: Ticket, as: "tickets" }],
    });
    res.json(toFrontend(updated));
  })
);

// DELETE /api/events/:id — delete event (admin only; bulk delete = N calls)
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    // Delete associated tickets first
    await Ticket.destroy({ where: { event_id: event.event_id } });
    await event.destroy();
    res.json({ success: true, message: "Event deleted" });
  })
);

export default router;
