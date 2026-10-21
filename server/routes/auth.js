import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { toPublicUser } from "../middleware/auth.js";

const router = Router();

/** Brute-force guard on login: 10 attempts / 15 min per IP. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts. Try again in 15 minutes." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN = 6;

// POST /api/auth/signup
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body ?? {};

    if (!name || String(name).trim().length < 2)
      return res.status(400).json({ error: "Please provide your full name." });
    if (!email || !EMAIL_RE.test(String(email)))
      return res.status(400).json({ error: "Please provide a valid email address." });
    if (!password || String(password).length < PASSWORD_MIN)
      return res
        .status(400)
        .json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: "user",
    });

    res.status(201).json(toPublicUser(user));
  })
);

// POST /api/auth/login
router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !EMAIL_RE.test(String(email)) || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
    // bcrypt compare against either the stored hash or a legacy plain-text value
    const matches =
      user &&
      (user.password.startsWith("$2") || user.password.startsWith("$a"))
        ? await bcrypt.compare(String(password), user.password)
        : user?.password === password;
    if (!user || !matches)
      return res.status(401).json({ error: "Invalid email or password." });

    // Lazy upgrade: if the stored password was plain text, hash it now.
    if (!user.password.startsWith("$2") && !user.password.startsWith("$a")) {
      await user.update({ password: await bcrypt.hash(String(password), 10) });
    }

    res.json(toPublicUser(user));
  })
);

export default router;
