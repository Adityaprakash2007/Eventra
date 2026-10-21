import { Router } from "express";
import { Event, Registration, Payment, Ticket, User, Feedback } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyEventAudience } from "../lib/notify.js";
import { Op, fn, col, literal } from "sequelize";

const router = Router();

/** Guard: 403 unless caller is admin or the event's organizer. */
async function requireOrganizer(req, res, event) {
  const isOrganizer = req.user.role === "admin" || event.organizer_id === req.user.user_id;
  if (!isOrganizer) {
    res.status(403).json({ success: false, error: "Organizer access required" });
    return false;
  }
  return true;
}

/**
 * GET /api/organizer/overview — organizer analytics for the signed-in user's
 * events (admins see everything): revenue, registrations, attendance,
 * conversion, ticket sales mix, growth and top performers.
 */
router.get(
  "/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const where = req.user.role === "admin" ? {} : { organizer_id: req.user.user_id };
    const events = await Event.findAll({ where, include: [{ model: Ticket, as: "tickets" }] });
    const eventIds = events.map((e) => e.event_id);

    const [regs, payments, feedbackRows] = await Promise.all([
      eventIds.length
        ? Registration.findAll({
            where: { event_id: { [Op.in]: eventIds } },
            include: [{ model: Event, as: "event", attributes: ["event_id", "title", "start_date", "capacity"] }],
          })
        : Promise.resolve([]),
      eventIds.length
        ? Payment.findAll({
            include: [
              {
                model: Registration,
                as: "registration",
                attributes: ["registration_id", "event_id"],
                where: { event_id: { [Op.in]: eventIds } },
              },
            ],
          })
        : Promise.resolve([]),
      eventIds.length
        ? Feedback.findAll({ where: { event_id: { [Op.in]: eventIds } }, attributes: ["event_id", "rating"] })
        : Promise.resolve([]),
    ]);

    // Per-event rollup
    const perEvent = events.map((e) => {
      const plain = e.get({ plain: true });
      const eventRegs = regs.filter((r) => r.event_id === plain.event_id);
      const confirmed = eventRegs.filter((r) => (r.status || "").toLowerCase() === "confirmed");
      const checkedIn = eventRegs.filter((r) => r.checked_in_at).length;
      const revenue = payments
        .filter((p) => p.registration?.event_id === plain.event_id && (p.payment_status || "").toLowerCase() === "completed")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const cap = plain.capacity || 0;
      const ratings = feedbackRows.filter((f) => f.event_id === plain.event_id).map((f) => Number(f.rating));

      return {
        eventId: plain.event_id,
        title: plain.title,
        startDate: plain.start_date,
        capacity: cap,
        registered: confirmed.length,
        checkedIn,
        revenue,
        conversionRate: cap > 0 ? Math.round((confirmed.length / cap) * 100) : 0,
        attendanceRate: confirmed.length ? Math.round((checkedIn / confirmed.length) * 100) : 0,
        avgRating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null,
      };
    });

    const totalRevenue = perEvent.reduce((s, e) => s + e.revenue, 0);
    const totalRegs = perEvent.reduce((s, e) => s + e.registered, 0);
    const totalCheckedIn = perEvent.reduce((s, e) => s + e.checkedIn, 0);
    const totalCapacity = perEvent.reduce((s, e) => s + e.capacity, 0);

    // 8-week registration growth trend across the organizer's events
    const now = Date.now();
    const weekBuckets = Array.from({ length: 8 }, (_, i) => ({
      label: `W-${7 - i}`,
      start: now - (7 - i) * 7 * 86400_000,
      registrations: 0,
      revenue: 0,
    }));
    for (const r of regs) {
      const t = new Date(r.registration_date || 0).getTime();
      for (const b of weekBuckets) {
        if (t >= b.start && t < b.start + 7 * 86400_000) {
          b.registrations++;
          break;
        }
      }
    }
    for (const p of payments) {
      if ((p.payment_status || "").toLowerCase() !== "completed") continue;
      const t = new Date(p.payment_date || 0).getTime();
      for (const b of weekBuckets) {
        if (t >= b.start && t < b.start + 7 * 86400_000) {
          b.revenue += Number(p.amount || 0);
          break;
        }
      }
    }

    res.json({
      summary: {
        totalEvents: events.length,
        totalRevenue,
        totalRegistrations: totalRegs,
        totalCheckedIn,
        avgConversion: totalCapacity ? Math.round((totalRegs / totalCapacity) * 100) : 0,
        avgAttendance: totalRegs ? Math.round((totalCheckedIn / totalRegs) * 100) : 0,
      },
      perEvent: perEvent.sort((a, b) => b.registered - a.registered),
      topEvents: [...perEvent].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      growth: weekBuckets.map(({ label, registrations, revenue }) => ({ label, registrations, revenue })),
    });
  })
);

/**
 * GET /api/organizer/events/:id/attendees — attendee management table data.
 * (Thin wrapper over the tickets route attendee list.)
 */
router.get(
  "/events/:id/attendees",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });
    if (!(await requireOrganizer(req, res, event))) return;

    const regs = await Registration.findAll({
      where: { event_id: event.event_id },
      include: [{ model: User, as: "user", attributes: ["user_id", "name", "email"] }],
      order: [["registration_id", "ASC"]],
    });

    res.json(
      regs.map((r) => {
        const p = r.get({ plain: true });
        return {
          registrationId: p.registration_id,
          name: p.user?.name || `User #${p.user_id}`,
          email: p.user?.email || "",
          ticketType: p.ticket_type || "Regular",
          status: p.status,
          ticketCode: p.ticket_code,
          registeredAt: p.registration_date,
          checkedInAt: p.checked_in_at,
          amount: p.total_amount != null ? Number(p.total_amount) : null,
        };
      })
    );
  })
);

/**
 * POST /api/organizer/events/:id/announce — send an announcement to every
 * confirmed attendee (optionally the waitlist too).
 */
router.post(
  "/events/:id/announce",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });
    if (!(await requireOrganizer(req, res, event))) return;

    const { title, message, includeWaitlist } = req.body ?? {};
    if (!title || !message) {
      return res.status(400).json({ success: false, error: "title and message are required" });
    }

    const reached = await notifyEventAudience(event.event_id, {
      type: "update",
      title: `📣 ${title}`,
      message,
      link: `/events/${event.event_id}`,
      includeWaitlist: !!includeWaitlist,
    });

    res.json({ success: true, reached });
  })
);

/**
 * POST /api/organizer/events — create an event as ORGANIZER (not just admin).
 * Mirrors the admin POST /api/events contract; safe to call alongside it.
 */
router.post(
  "/events",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, venue, date, seats, price, city, state, category, description, image, agenda } = req.body ?? {};
    if (!title || !venue || !date) {
      return res.status(400).json({ success: false, error: "title, venue, and date are required" });
    }
    const event = await Event.create({
      title,
      venue,
      state: state || null,
      city: city || null,
      description: description || "",
      start_date: new Date(date),
      end_date: new Date(date),
      category: category || "General",
      capacity: seats ?? 0,
      status: "Open",
      organizer_id: req.user.user_id,
      image: image || null,
      agenda: agenda || null,
    });

    if (price != null) {
      await Ticket.create({
        ticket_id: 1,
        event_id: event.event_id,
        type: "Regular",
        price: price || 0,
        quantity_available: seats ?? 0,
      });
    }

    res.status(201).json({ success: true, eventId: event.event_id });
  })
);

export default router;
