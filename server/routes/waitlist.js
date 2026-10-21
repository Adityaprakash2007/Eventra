import { Router } from "express";
import { Waitlist, Event, Ticket, Registration, User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyUser } from "../lib/notify.js";
import { promoteWaitlisted } from "./registrations.js";

const router = Router();

// GET /api/waitlist — my waitlist entries (with position + event)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const entries = await Waitlist.findAll({
      where: { user_id: req.user.user_id },
      include: [{ model: Event, as: "event", attributes: ["event_id", "title", "start_date", "venue", "city"] }],
      order: [["waitlist_id", "DESC"]],
    });

    const shaped = [];
    for (const w of entries) {
      const plain = w.get({ plain: true });
      // Position = number of earlier active waiters for this event
      const ahead = plain.status === "waiting"
        ? await Waitlist.count({ where: { event_id: plain.event_id, status: "waiting", waitlist_id: { [Waitlist.sequelize.Op.lt]: plain.waitlist_id } } })
        : null;
      shaped.push({
        id: plain.waitlist_id,
        eventId: plain.event_id,
        status: plain.status,
        joinedAt: plain.joined_at,
        promotedAt: plain.promoted_at,
        position: ahead != null ? ahead + 1 : null,
        event: plain.event
          ? { id: plain.event.event_id, title: plain.event.title, date: plain.event.start_date, venue: plain.event.venue, city: plain.event.city }
          : null,
      });
    }
    res.json(shaped);
  })
);

// GET /api/waitlist/event/:eventId — organizer view of the queue
router.get(
  "/event/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });
    const isOrganizer = req.user.role === "admin" || event.organizer_id === req.user.user_id;
    if (!isOrganizer) return res.status(403).json({ success: false, error: "Organizer access required" });

    const entries = await Waitlist.findAll({
      where: { event_id: event.event_id, status: "waiting" },
      include: [{ model: User, as: "user", attributes: ["user_id", "name", "email"] }],
      order: [["waitlist_id", "ASC"]],
    });

    res.json(
      entries.map((w) => {
        const p = w.get({ plain: true });
        return { id: p.waitlist_id, name: p.user?.name, email: p.user?.email, joinedAt: p.joined_at };
      })
    );
  })
);

// POST /api/waitlist — join the waitlist for a (sold-out) event
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.body?.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: "eventId is required" });

    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const already = await Registration.findOne({ where: { user_id: req.user.user_id, event_id: eventId } });
    if (already) return res.status(409).json({ success: false, error: "You're already registered for this event" });

    const [entry, created] = await Waitlist.findOrCreate({
      where: { user_id: req.user.user_id, event_id: eventId },
      defaults: { status: "waiting" },
    });

    if (!created && entry.status !== "waiting") {
      return res.status(409).json({ success: false, error: `Your waitlist entry is ${entry.status}` });
    }

    const ahead = await Waitlist.count({
      where: { event_id: eventId, status: "waiting", waitlist_id: { [Waitlist.sequelize.Op.lt]: entry.waitlist_id } },
    });

    if (created) {
      await notifyUser(req.user.user_id, {
        type: "waitlist",
        title: "Added to waitlist",
        message: `You're #${ahead + 1} on the waitlist for ${event.title}. We'll move you up automatically when a seat frees.`,
        link: "/tickets",
      });
    }

    res.status(created ? 201 : 200).json({
      id: entry.waitlist_id,
      position: ahead + 1,
      status: entry.status,
      message: created ? `You're #${ahead + 1} on the waitlist.` : "You're already on the waitlist.",
    });
  })
);

// DELETE /api/waitlist/:id — leave the waitlist
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const entry = await Waitlist.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Waitlist entry not found" });
    if (entry.user_id !== req.user.user_id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Not your waitlist entry" });
    }
    await entry.update({ status: "cancelled" });
    res.json({ success: true, message: "Removed from waitlist" });
  })
);

/**
 * POST /api/waitlist/promote/:eventId — organizer manually promotes the next
 * N waiting users (or all, when seats allow). Normally automatic.
 */
router.post(
  "/promote/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await Event.findByPk(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });
    const isOrganizer = req.user.role === "admin" || event.organizer_id === req.user.user_id;
    if (!isOrganizer) return res.status(403).json({ success: false, error: "Organizer access required" });

    const promoted = await promoteWaitlisted(event.event_id);
    for (const p of promoted) {
      await notifyUser(p.user_id, {
        type: "waitlist",
        title: "🎉 A seat opened up!",
        message: `You've been promoted to a confirmed seat for ${event.title}.`,
        link: "/tickets",
      });
    }
    res.json({ success: true, promoted: promoted.length });
  })
);

export default router;
