import { Router } from "express";
import { User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// POST /api/auth/signup
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    const user = await User.create({ name, email, password, role: "user" });

    res.status(201).json({
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ where: { email } });
    if (!user || user.password !== password)
      return res.status(401).json({ error: "Invalid email or password." });

    res.json({
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  })
);

export default router;
