import { Router } from "express";
import { Event, Ticket } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// Helper: transform DB event row into frontend-expected shape
function toFrontend(e) {
  const plain = e.get ? e.get({ plain: true }) : e;
  // Get price from first ticket if available, else 0
  const tickets = plain.tickets || [];
  const price = tickets.length > 0 ? Number(tickets[0].price) : 0;
  const seats = plain.capacity || 0;

  return {
    id: plain.event_id,
    title: plain.title,
    venue: plain.venue || "",
    date: plain.start_date ? new Date(plain.start_date).toISOString().split("T")[0] : "",
    seats,
    price,
    image: null,
    description: plain.description,
    category: plain.category,
    status: plain.status,
  };
}

// GET /api/events — list all events
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const events = await Event.findAll({
      include: [{ model: Ticket, as: "tickets", attributes: ["type", "price", "quantity_available"] }],
      order: [["start_date", "ASC"]],
    });
    res.json(events.map(toFrontend));
  })
);

// GET /api/events/:id — single event
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id, {
      include: [{ model: Ticket, as: "tickets", attributes: ["type", "price", "quantity_available"] }],
    });
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });
    res.json(toFrontend(event));
  })
);

// POST /api/events — create event
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, venue, date, seats, price } = req.body;
    if (!title || !venue || !date) {
      return res.status(400).json({ success: false, error: "title, venue, and date are required" });
    }
    const event = await Event.create({
      title,
      venue,
      description: req.body.description || "",
      start_date: new Date(date),
      end_date: new Date(date),
      category: req.body.category || "General",
      capacity: seats ?? 0,
      status: "Open",
      organizer_id: req.body.organizer_id || 1,
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

    const created = await Event.findByPk(event.event_id, {
      include: [{ model: Ticket, as: "tickets" }],
    });
    res.status(201).json(toFrontend(created));
  })
);

// PUT /api/events/:id — update event
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const { title, venue, date, seats, price } = req.body;
    await event.update({
      ...(title && { title }),
      ...(venue && { venue }),
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

// DELETE /api/events/:id — delete event
router.delete(
  "/:id",
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
