import { Router } from "express";
import { User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function toFrontend(u) {
  const plain = u.get ? u.get({ plain: true }) : u;
  return {
    id: plain.user_id,
    name: plain.name,
    email: plain.email,
    role: plain.role,
    joined: plain.created_at ? new Date(plain.created_at).toISOString().split("T")[0] : "",
  };
}

// GET /api/users — list all users (admin only)
router.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.findAll({ order: [["created_at", "DESC"]] });
    res.json(users.map(toFrontend));
  })
);

// GET /api/users/:id — single user (self or admin)
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (req.user.role !== "admin" && req.user.user_id !== user.user_id) {
      return res.status(403).json({ success: false, error: "You can only view your own profile" });
    }
    res.json(toFrontend(user));
  })
);

// PUT /api/users/:id — update profile (self only; role changes stay admin-side)
router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (req.user.role !== "admin" && req.user.user_id !== user.user_id) {
      return res.status(403).json({ success: false, error: "You can only edit your own profile" });
    }

    const { name, phone, bio } = req.body ?? {};
    const updates = {};
    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length < 2) return res.status(400).json({ success: false, error: "Name is too short" });
      updates.name = n;
    }
    if (phone !== undefined) updates.phone = phone ? String(phone).trim().slice(0, 30) : null;
    if (bio !== undefined) updates.bio = bio ? String(bio).slice(0, 1000) : null;

    await user.update(updates);
    res.json(toFrontend(user));
  })
);

export default router;
