import { Router } from "express";
import bcrypt from "bcryptjs";
import { User, Registration, SavedEvent, Ticket, Feedback, Event } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function toPublic(u) {
  const p = u.get ? u.get({ plain: true }) : u;
  return {
    id: p.user_id,
    name: p.name,
    email: p.email,
    role: p.role,
    phone: p.phone || null,
    bio: p.bio || null,
    avatarColor: p.avatar_color || "indigo",
    interests: p.interests ? p.interests.split(",").map((s) => s.trim()).filter(Boolean) : [],
    state: p.state || null,
    city: p.city || null,
    joined: p.created_at,
  };
}

// GET /api/profile — my full profile + activity rollup
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const [regs, saves, feedbackRows] = await Promise.all([
      Registration.findAll({
        where: { user_id: user.user_id },
        include: [{ model: Event, as: "event", attributes: ["event_id", "title", "start_date", "venue", "city", "category"] }],
        order: [["registration_id", "DESC"]],
      }),
      SavedEvent.count({ where: { user_id: user.user_id } }),
      Feedback.findAll({ where: { user_id: user.user_id }, attributes: ["rating", "feedback_id"] }),
    ]);

    const now = new Date();
    const registrations = regs.map((r) => {
      const p = r.get({ plain: true });
      return {
        id: p.registration_id,
        status: p.status,
        ticketType: p.ticket_type || "Regular",
        ticketCode: p.ticket_code,
        totalAmount: p.total_amount != null ? Number(p.total_amount) : null,
        registeredAt: p.registration_date,
        checkedInAt: p.checked_in_at,
        event: p.event
          ? {
              id: p.event.event_id,
              title: p.event.title,
              date: p.event.start_date,
              venue: p.event.venue,
              city: p.event.city,
              category: p.event.category,
              upcoming: new Date(p.event.start_date) >= now,
            }
          : null,
      };
    });

    res.json({
      profile: toPublic(user),
      activity: {
        totalRegistrations: registrations.length,
        upcoming: registrations.filter((r) => r.event?.upcoming).length,
        attended: registrations.filter((r) => !r.event?.upcoming).length,
        savedEvents: saves,
        reviewsWritten: feedbackRows.length,
      },
      registrations,
    });
  })
);

// PUT /api/profile — update my profile
router.put(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const { name, phone, bio, interests, state, city, avatarColor } = req.body ?? {};
    const updates = {};
    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length < 2) return res.status(400).json({ success: false, error: "Name is too short" });
      updates.name = n;
    }
    if (phone !== undefined) updates.phone = phone ? String(phone).trim().slice(0, 30) : null;
    if (bio !== undefined) updates.bio = bio ? String(bio).slice(0, 1000) : null;
    if (interests !== undefined) {
      updates.interests = Array.isArray(interests)
        ? interests.map((s) => String(s).trim()).filter(Boolean).slice(0, 12).join(",")
        : String(interests).slice(0, 300);
    }
    if (state !== undefined) updates.state = state || null;
    if (city !== undefined) updates.city = city || null;
    if (avatarColor !== undefined) updates.avatar_color = String(avatarColor).slice(0, 20);

    await user.update(updates);
    res.json({ success: true, profile: toPublic(user) });
  })
);

// PUT /api/profile/password — change my password
router.put(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
    }
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const stored = user.password;
    const matches = stored.startsWith("$2") || stored.startsWith("$a")
      ? await bcrypt.compare(String(currentPassword), stored)
      : stored === currentPassword;
    if (!matches) return res.status(403).json({ success: false, error: "Current password is incorrect" });

    await user.update({ password: await bcrypt.hash(String(newPassword), 10) });
    res.json({ success: true });
  })
);

export default router;
