import { Router } from "express";
import { Notification } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications — my notifications, newest first (?unread=1 to filter)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const where = { user_id: req.user.user_id };
    if (req.query.unread === "1") where.read_at = null;

    const rows = await Notification.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit: 100,
    });

    res.json(
      rows.map((n) => {
        const p = n.get({ plain: true });
        return {
          id: p.notification_id,
          type: p.type,
          title: p.title,
          message: p.message,
          link: p.link,
          read: !!p.read_at,
          readAt: p.read_at,
          time: p.created_at,
        };
      })
    );
  })
);

// GET /api/notifications/unread-count — cheap poll target for the bell badge
router.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await Notification.count({ where: { user_id: req.user.user_id, read_at: null } });
    res.json({ count });
  })
);

// POST /api/notifications/read-all — mark everything read
router.post(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Notification.update({ read_at: new Date() }, { where: { user_id: req.user.user_id, read_at: null } });
    res.json({ success: true });
  })
);

// POST /api/notifications/:id/read — mark one read
router.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Notification.update(
      { read_at: new Date() },
      { where: { notification_id: Number(req.params.id), user_id: req.user.user_id } }
    );
    res.json({ success: true });
  })
);

// DELETE /api/notifications/:id — remove one
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Notification.destroy({ where: { notification_id: Number(req.params.id), user_id: req.user.user_id } });
    res.json({ success: true });
  })
);

// DELETE /api/notifications — clear all
router.delete(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Notification.destroy({ where: { user_id: req.user.user_id } });
    res.json({ success: true });
  })
);

export default router;
