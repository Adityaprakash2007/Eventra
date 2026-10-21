import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/** Strip the password hash and attach a fresh JWT — the only user shape the API returns. */
export function toPublicUser(user) {
  return {
    id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: signToken(user),
  };
}

/** Sign a JWT for a user row (payload carries id + role only). */
export function signToken(user) {
  if (!JWT_SECRET) {
    throw Object.assign(new Error("JWT_SECRET is not set — add it to .env"), { statusCode: 500 });
  }
  return jwt.sign({ id: user.user_id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * requireAuth — verifies the Authorization: Bearer <token> header and attaches
 * the fresh user row to req.user (id + role always come from the DB/token,
 * never from the request body).
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ success: false, error: "Account no longer exists" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired session" });
  }
}

/** requireAdmin — must run after requireAuth; allows role === "admin" only. */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}
