import { Router } from "express";
import { sequelize, Registration, Event, User, Ticket, Waitlist } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyUser } from "../lib/notify.js";
import { generateTicketCode } from "../lib/tickets.js";
import { Op } from "sequelize";

const router = Router();

function toFrontend(r) {
  const plain = r.get ? r.get({ plain: true }) : r;
  return {
    id: plain.registration_id,
    user: plain.user?.name || `User #${plain.user_id}`,
    userId: plain.user_id,
    eventId: plain.event_id,
    ticket: plain.ticket_type || "Regular",
    ticketCode: plain.ticket_code || null,
    status: plain.status || "Pending",
    totalAmount: plain.total_amount != null ? Number(plain.total_amount) : null,
    checkedInAt: plain.checked_in_at || null,
    registeredAt: plain.registration_date || null,
    event: plain.event ? { id: plain.event.event_id, title: plain.event.title, date: plain.event.start_date } : null,
  };
}

// GET /api/registrations — own registrations for everyone; ALL for admins
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user.role === "admin";
    const registrations = await Registration.findAll({
      where: isAdmin ? {} : { user_id: req.user.user_id },
      include: [
        { model: Event, as: "event", attributes: ["event_id", "title", "start_date", "venue", "city", "state"] },
        { model: User, as: "user", attributes: ["user_id", "name"] },
      ],
      order: [["registration_id", "DESC"]],
    });
    res.json(registrations.map(toFrontend));
  })
);

// GET /api/registrations/:id — a registration (owner or admin only)
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reg = await Registration.findByPk(req.params.id, {
      include: [
        { model: Event, as: "event" },
        { model: User, as: "user", attributes: ["user_id", "name", "email"] },
      ],
    });
    if (!reg) return res.status(404).json({ success: false, error: "Registration not found" });
    if (req.user.role !== "admin" && reg.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: "You can only view your own registrations" });
    }
    res.json(toFrontend(reg));
  })
);

/**
 * Promote the earliest waiting users into free seats. Runs inside the caller's
 * transaction when provided (booking flow) so promotion is atomic with the
 * seat release; otherwise it runs standalone (e.g. after a cancellation).
 * Returns the list of promoted registration rows.
 */
export async function promoteWaitlisted(eventId, transaction = null) {
  const promoted = [];
  // Loop: keep filling seats until either the waitlist is drained or the ticket is sold out again.
  for (;;) {
    const ticketRow = await Ticket.findOne({
      where: { event_id: eventId },
      ...(transaction ? { transaction } : {}),
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!ticketRow || !ticketRow.quantity_available || Number(ticketRow.quantity_available) <= 0) break;

    const next = await Waitlist.findOne({
      where: { event_id: eventId, status: "waiting" },
      order: [["waitlist_id", "ASC"]], // fair FIFO
      ...(transaction ? { transaction } : {}),
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!next) break;

    const [reg, created] = await Registration.findOrCreate({
      where: { user_id: next.user_id, event_id: eventId },
      defaults: {
        status: "Confirmed",
        ticket_type: "Regular",
        ticket_code: generateTicketCode(),
        total_amount: Number(ticketRow.price) || 0,
      },
      transaction,
    });

    if (created) {
      const newAvailable = Number(ticketRow.quantity_available) - 1;
      await ticketRow.update({ quantity_available: newAvailable }, { transaction });
    }
    await next.update({ status: "promoted", promoted_at: new Date() }, { transaction });
    promoted.push(reg);
  }
  return promoted;
}

// POST /api/registrations — book a seat (logged-in users).
// When the event is sold out the caller can pass waitlist: true to join the
// waitlist instead. The seat check, seat decrement and registration insert run
// inside ONE transaction with a row lock on the ticket row, so concurrent
// bookings can never oversell the last seats.
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { eventId, ticket, waitlist } = req.body ?? {};
    if (!eventId) {
      return res.status(400).json({ success: false, error: "eventId is required" });
    }
    const ticketType = ticket === "VIP" ? "VIP" : "Regular";
    // The booking user is ALWAYS the authenticated user — never a body field.
    const userId = req.user.user_id;

    // Duplicate guard up-front (friendlier than a 409 from inside the txn).
    const existing = await Registration.findOne({ where: { user_id: userId, event_id: eventId } });
    if (existing) {
      return res.status(409).json({ success: false, error: "You have already registered for this event" });
    }

    try {
      const result = await sequelize.transaction(async (t) => {
        // Lock the ticket row for this event (LOCK UPDATE) until commit.
        const ticketRow = await Ticket.findOne({
          where: { event_id: eventId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!ticketRow) {
          throw Object.assign(new Error("This event has no bookable ticket yet"), { statusCode: 409 });
        }

        if (ticketRow.quantity_available == null || ticketRow.quantity_available <= 0) {
          if (waitlist) {
            // Join (or confirm already-on) the waitlist — no seat consumed.
            const [wl, wlCreated] = await Waitlist.findOrCreate({
              where: { user_id: userId, event_id: eventId },
              defaults: { status: "waiting" },
              transaction: t,
            });
            return { waitlisted: true, position: wl.waitlist_id, created: wlCreated };
          }
          throw Object.assign(new Error("Sold out — no seats left for this event"), { statusCode: 409 });
        }

        const newAvailable = Number(ticketRow.quantity_available) - 1; // guarded above: never < 0
        await ticketRow.update({ quantity_available: newAvailable }, { transaction: t });

        const event = await Event.findByPk(eventId, { transaction: t });
        const basePrice = Number(ticketRow.price) || 0;
        const amount = ticketType === "VIP" ? basePrice * 2 : basePrice;

        const reg = await Registration.create(
          {
            user_id: userId,
            event_id: eventId,
            status: "Confirmed",
            ticket_type: ticketType,
            ticket_code: generateTicketCode(),
            total_amount: amount,
          },
          { transaction: t }
        );

        return { waitlisted: false, reg, amount, eventTitle: event?.title };
      });

      if (result.waitlisted) {
        if (result.created) {
          await notifyUser(userId, {
            type: "waitlist",
            title: "Added to waitlist",
            message: `You're on the waitlist for this event (position #${result.position}). We'll notify you if a seat opens up.`,
            link: "/tickets",
          });
        }
        return res.status(202).json({
          waitlisted: true,
          position: result.position,
          message: "Event is sold out — you've been added to the waitlist.",
        });
      }

      // After a successful booking, fill any freed seats from the waitlist
      // (no-op when nobody is waiting; also outside this transaction).
      await promoteWaitlisted(eventId).catch(() => {});

      res.status(201).json({
        id: result.reg.registration_id,
        user: req.user.name,
        userId,
        eventId: Number(eventId),
        ticket: result.reg.ticket_type || ticketType,
        ticketCode: result.reg.ticket_code,
        status: "Confirmed",
        amount: result.amount,
        event: result.eventTitle ? { id: Number(eventId), title: result.eventTitle } : null,
      });
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({ success: false, error: err.message });
      }
      throw err;
    }
  })
);

// DELETE /api/registrations/:id — cancel (owner). Frees the seat and promotes
// the earliest waiting user automatically.
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reg = await Registration.findByPk(req.params.id, { include: [{ model: Event, as: "event" }] });
    if (!reg) return res.status(404).json({ success: false, error: "Registration not found" });
    if (req.user.role !== "admin" && reg.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: "You can only cancel your own registrations" });
    }

    const eventId = reg.event_id;
    const wasConfirmed = (reg.status || "").toLowerCase() === "confirmed";

    await sequelize.transaction(async (t) => {
      await reg.destroy({ transaction: t });

      if (wasConfirmed) {
        const ticketRow = await Ticket.findOne({ where: { event_id: eventId }, transaction: t, lock: t.LOCK.UPDATE });
        if (ticketRow && ticketRow.quantity_available != null) {
          await ticketRow.update({ quantity_available: Number(ticketRow.quantity_available) + 1 }, { transaction: t });
        }
      }
    });

    // Freed seat → promote waitlist (outside txn; failures are non-fatal)
    if (wasConfirmed) {
      try {
        const promoted = await promoteWaitlisted(eventId);
        for (const p of promoted) {
          await notifyUser(p.user_id, {
            type: "waitlist",
            title: "🎉 A seat opened up!",
            message: `You've been promoted from the waitlist to a confirmed seat for ${reg.event?.title ?? "the event"}. Complete your ticket in My Tickets.`,
            link: "/tickets",
          });
        }
      } catch { /* best-effort */ }
    }

    // Cancelled refunds surface in Payment History automatically.
    await notifyUser(reg.user_id, {
      type: "registration",
      title: "Registration cancelled",
      message: `Your registration for ${reg.event?.title ?? "the event"} was cancelled.`,
      link: "/tickets",
    });

    res.json({ success: true, message: "Registration cancelled" });
  })
);

export default router;
