import { Notification, User, Event } from "../models/index.js";

/**
 * Server-side notification creation. Every user-facing flow (booking, payment,
 * waitlist promotion, check-in reminders, announcements) funnels through here
 * so the Notification Center page and the bell both show the same truth.
 *
 * Best-effort: notification failures must never break the primary flow.
 */
export async function notifyUser(userId, { type = "system", title, message = null, link = null }) {
  try {
    await Notification.create({ user_id: userId, type, title, message, link });
  } catch (err) {
    console.warn("notifyUser failed:", err.message);
  }
}

export async function notifyMany(userIds, payload) {
  await Promise.allSettled(userIds.map((id) => notifyUser(id, payload)));
}

/**
 * Announce to every confirmed registrant of an event (organizer announcements)
 * and optionally the waitlist.
 */
export async function notifyEventAudience(eventId, { title, message, link = null, type = "update", includeWaitlist = false }) {
  try {
    const { Registration, Waitlist } = await import("../models/index.js");
    const regs = await Registration.findAll({
      where: { event_id: eventId },
      attributes: ["user_id"],
    });
    const ids = [...new Set(regs.map((r) => r.user_id))];

    if (includeWaitlist) {
      const wl = await Waitlist.findAll({
        where: { event_id: eventId, status: "waiting" },
        attributes: ["user_id"],
      });
      ids.push(...wl.map((w) => w.user_id));
    }

    await notifyMany([...new Set(ids)], { type, title, message, link });
    return ids.length;
  } catch (err) {
    console.warn("notifyEventAudience failed:", err.message);
    return 0;
  }
}

/** Build the organizer display name for an event (fallback chain). */
export async function organizerForEvent(event) {
  if (event.organizer_name) return { name: event.organizer_name, bio: event.organizer_bio || null };
  try {
    const u = await User.findByPk(event.organizer_id, { attributes: ["user_id", "name", "bio"] });
    return { name: u?.name || "Eventra Team", bio: u?.bio || null };
  } catch {
    return { name: "Eventra Team", bio: null };
  }
}

/** Small helper used by several routes: event + organizer + seats context. */
export async function eventContext(eventId) {
  const event = await Event.findByPk(eventId);
  return event;
}
