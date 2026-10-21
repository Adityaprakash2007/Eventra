import { Router } from "express";
import { Feedback, Event, Registration, User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyUser } from "../lib/notify.js";
import { Op, fn, col, literal } from "sequelize";

const router = Router();

/**
 * POST /api/feedback — submit a rating + review for a completed event.
 * Requires a confirmed registration; one review per user per event.
 */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.body?.eventId);
    const rating = Number(req.body?.rating);
    const review = String(req.body?.review || "").trim().slice(0, 4000);

    if (!eventId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: "eventId and a rating of 1–5 are required" });
    }

    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    // Only attendees who registered (and the event is over) can review.
    const reg = await Registration.findOne({
      where: { user_id: req.user.user_id, event_id: eventId },
    });
    if (!reg) {
      return res.status(403).json({ success: false, error: "Only registered attendees can leave feedback" });
    }
    if (new Date(event.end_date || event.start_date) > new Date()) {
      return res.status(409).json({ success: false, error: "Feedback opens after the event ends" });
    }

    const [feedback, created] = await Feedback.findOrCreate({
      where: { user_id: req.user.user_id, event_id: eventId },
      defaults: { rating, review: review || null },
    });
    if (!created) {
      await feedback.update({ rating, review: review || feedback.review });
      return res.json({ success: true, updated: true, feedback });
    }

    // Nudge the organizer that new feedback arrived.
    await notifyUser(event.organizer_id, {
      type: "update",
      title: "New feedback received ⭐",
      message: `${req.user.name} rated ${event.title} ${rating}/5.`,
      link: `/organizer`,
    });

    res.status(201).json({ success: true, feedback });
  })
);

/**
 * GET /api/feedback/event/:eventId — reviews + aggregate analytics for one event.
 * Public shape: list of reviews and avg/breakdown stats.
 */
router.get(
  "/event/:eventId",
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.eventId);
    const feedback = await Feedback.findAll({
      where: { event_id: eventId },
      include: [{ model: User, as: "user", attributes: ["user_id", "name"] }],
      order: [["feedback_id", "DESC"]],
    });

    const rows = feedback.map((f) => {
      const p = f.get({ plain: true });
      return {
        id: p.feedback_id,
        rating: p.rating,
        review: p.review,
        createdAt: p.created_at,
        user: p.user?.name || "Attendee",
      };
    });

    const count = rows.length;
    const avg = count ? rows.reduce((s, r) => s + r.rating, 0) / count : 0;
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;

    res.json({ reviews: rows, average: Math.round(avg * 10) / 10, count, breakdown });
  })
);

/**
 * GET /api/feedback/mine — feedback I've submitted (profile page).
 */
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const mine = await Feedback.findAll({
      where: { user_id: req.user.user_id },
      include: [{ model: Event, as: "event", attributes: ["event_id", "title", "start_date"] }],
      order: [["feedback_id", "DESC"]],
    });
    res.json(
      mine.map((f) => {
        const p = f.get({ plain: true });
        return {
          id: p.feedback_id,
          rating: p.rating,
          review: p.review,
          createdAt: p.created_at,
          event: p.event ? { id: p.event.event_id, title: p.event.title } : null,
        };
      })
    );
  })
);

export default router;
