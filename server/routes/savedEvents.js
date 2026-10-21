import { Router } from "express";
import { SavedEvent, Event, User, Ticket } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** GET /api/saved — the signed-in user's saved events (full event shape). */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const saves = await SavedEvent.findAll({
      where: { user_id: req.user.user_id },
      include: [
        {
          model: Event,
          as: "event",
          include: [{ model: Ticket, as: "tickets", attributes: ["type", "price", "quantity_available"] }],
        },
      ],
      order: [["saved_id", "DESC"]],
    });

    // Reuse the events route's frontend shape for consistency.
    const { default: eventsRouterModule } = await import("./events.js").then(() => ({ default: null })).catch(() => ({ default: null }));
    const rows = saves
      .filter((s) => s.event)
      .map((s) => {
        const e = s.event.get({ plain: true });
        const tickets = e.tickets || [];
        const price = tickets.length > 0 ? Number(tickets[0].price) : 0;
        const fromTicket = tickets.length > 0 ? Number(tickets[0].quantity_available) : NaN;
        const seats = Number.isFinite(fromTicket) && fromTicket >= 0 ? fromTicket : e.capacity || 0;
        return {
          id: e.event_id,
          title: e.title,
          venue: e.venue || "",
          state: e.state,
          city: e.city,
          date: e.start_date ? new Date(e.start_date).toISOString().split("T")[0] : "",
          time: e.start_date
            ? new Date(e.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
            : "",
          seats,
          price,
          image: e.image,
          description: e.description,
          category: e.category,
          status: e.status,
          savedAt: s.created_at,
        };
      });
    res.json(rows);
  })
);

/** POST /api/saved — save (bookmark) an event. Idempotent. */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.body?.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: "eventId is required" });
    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const [, created] = await SavedEvent.findOrCreate({
      where: { user_id: req.user.user_id, event_id: eventId },
      defaults: {},
    });
    res.status(created ? 201 : 200).json({ success: true, saved: true });
  })
);

/** DELETE /api/saved/:eventId — unsave an event. */
router.delete(
  "/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    await SavedEvent.destroy({ where: { user_id: req.user.user_id, event_id: Number(req.params.eventId) } });
    res.json({ success: true, saved: false });
  })
);

export default router;
