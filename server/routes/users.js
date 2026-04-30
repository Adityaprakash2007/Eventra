import { Router } from "express";
import { User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

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

// GET /api/users — list all users
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await User.findAll({ order: [["created_at", "DESC"]] });
    res.json(users.map(toFrontend));
  })
);

// GET /api/users/:id — single user
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    res.json(toFrontend(user));
  })
);

export default router;
