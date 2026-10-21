import { Router } from "express";
import QRCode from "qrcode";
import { sequelize, Registration, Event, User, Ticket } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { generateTicketCode, normalizeCode, isValidCodeShape } from "../lib/tickets.js";
import { notifyUser } from "../lib/notify.js";
import { Op } from "sequelize";

const router = Router();

function toTicketShape(reg, event, user) {
  const e = event?.get ? event.get({ plain: true }) : event;
  return {
    registrationId: reg.registration_id,
    ticketCode: reg.ticket_code,
    ticketType: reg.ticket_type || "Regular",
    status: reg.status || "Pending",
    registeredAt: reg.registration_date,
    checkedInAt: reg.checked_in_at,
    amount: reg.total_amount != null ? Number(reg.total_amount) : null,
    event: e
      ? {
          id: e.event_id,
          title: e.title,
          venue: e.venue,
          city: e.city,
          state: e.state,
          category: e.category,
          image: e.image,
          startDate: e.start_date,
          endDate: e.end_date,
        }
      : null,
    user: user
      ? { id: user.user_id, name: user.name, email: user.email }
      : null,
  };
}

async function loadRegistration(idOrCode) {
  const where = isValidCodeShape(normalizeCode(idOrCode))
    ? { ticket_code: normalizeCode(idOrCode) }
    : !isNaN(Number(idOrCode))
      ? { registration_id: Number(idOrCode) }
      : null;
  if (!where) return null;
  return Registration.findOne({
    where,
    include: [
      { model: Event, as: "event" },
      { model: User, as: "user", attributes: ["user_id", "name", "email"] },
    ],
  });
}

/**
 * GET /api/tickets — the signed-in user's tickets, split into upcoming/past.
 * A registration is "upcoming" when its event hasn't ended yet.
 */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const regs = await Registration.findAll({
      where: { user_id: req.user.user_id },
      include: [{ model: Event, as: "event" }],
      order: [["registration_id", "DESC"]],
    });

    const now = new Date();
    const tickets = regs.map((r) => toTicketShape(r, r.event, req.user));
    const upcoming = tickets.filter((t) => t.event && new Date(t.event.endDate || t.event.startDate) >= now);
    const past = tickets.filter((t) => !t.event || new Date(t.event.endDate || t.event.startDate) < now);

    res.json({ upcoming, past, total: tickets.length });
  })
);

/**
 * GET /api/tickets/:idOrCode — one ticket (owner or admin).
 * Accepts either a registration id or the full EVTR-…-… code.
 */
router.get(
  "/:idOrCode",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reg = await loadRegistration(req.params.idOrCode);
    if (!reg) return res.status(404).json({ success: false, error: "Ticket not found" });
    if (req.user.role !== "admin" && reg.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: "You can only view your own tickets" });
    }
    res.json(toTicketShape(reg, reg.event, reg.user));
  })
);

/**
 * GET /api/tickets/:idOrCode/qr — PNG data URL of the QR code.
 * The QR payload is the ticket code itself; the scanner posts it back.
 */
router.get(
  "/:idOrCode/qr",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reg = await loadRegistration(req.params.idOrCode);
    if (!reg) return res.status(404).json({ success: false, error: "Ticket not found" });
    if (req.user.role !== "admin" && reg.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: "Not your ticket" });
    }
    const dataUrl = await QRCode.toDataURL(reg.ticket_code, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    res.json({ qr: dataUrl, ticketCode: reg.ticket_code });
  })
);

/**
 * POST /api/tickets — (re)issue a ticket for an existing registration.
 * Idempotent: returns the existing code when one is already present.
 */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { registrationId } = req.body ?? {};
    const reg = await Registration.findByPk(registrationId, {
      include: [{ model: Event, as: "event" }],
    });
    if (!reg) return res.status(404).json({ success: false, error: "Registration not found" });
    if (req.user.role !== "admin" && reg.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: "Not your registration" });
    }
    if (!reg.ticket_code) {
      reg.ticket_code = generateTicketCode();
      await reg.save();
      await notifyUser(reg.user_id, {
        type: "ticket",
        title: "Ticket generated 🎟️",
        message: `Your ticket for ${reg.event?.title ?? "the event"} is ready. View or download it in My Tickets.`,
        link: `/tickets/${reg.registration_id}`,
      });
    }
    res.status(201).json(toTicketShape(reg, reg.event, req.user));
  })
);

/**
 * POST /api/tickets/checkin — organizer/admin scans a code.
 * Verifies the ticket, prevents duplicate entry, marks attendance.
 * Body: { code } — the raw EVTR-… string from the QR.
 */
router.post(
  "/checkin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const code = normalizeCode(req.body?.code);
    if (!isValidCodeShape(code)) {
      return res.status(400).json({ success: false, error: "Invalid ticket code format" });
    }

    const reg = await Registration.findOne({
      where: { ticket_code: code },
      include: [
        { model: Event, as: "event" },
        { model: User, as: "user", attributes: ["user_id", "name", "email"] },
      ],
    });
    if (!reg) {
      return res.status(404).json({ success: false, error: "Ticket not recognized", valid: false });
    }

    // Only the organizer of the event or an admin may scan tickets.
    const isOrganizer = req.user.role === "admin" || reg.event?.organizer_id === req.user.user_id;
    if (!isOrganizer) {
      return res.status(403).json({ success: false, error: "Only the event organizer can check in attendees" });
    }

    if ((reg.status || "").toLowerCase() !== "confirmed") {
      return res.status(409).json({ success: false, error: `Ticket is ${reg.status || "not confirmed"}`, valid: false });
    }

    if (reg.checked_in_at) {
      return res.status(409).json({
        success: false,
        valid: true, // the ticket is real — just already used
        duplicate: true,
        checkedInAt: reg.checked_in_at,
        error: `Already checked in at ${new Date(reg.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
        attendee: { name: reg.user?.name, ticketType: reg.ticket_type },
      });
    }

    reg.checked_in_at = new Date();
    await reg.save();

    await notifyUser(reg.user_id, {
      type: "registration",
      title: "Checked in ✅",
      message: `You're checked in for ${reg.event?.title ?? "the event"}. Enjoy!`,
    });

    res.json({
      success: true,
      valid: true,
      duplicate: false,
      checkedInAt: reg.checked_in_at,
      attendee: {
        name: reg.user?.name,
        email: reg.user?.email,
        ticketType: reg.ticket_type || "Regular",
        registrationId: reg.registration_id,
      },
      event: reg.event ? { id: reg.event.event_id, title: reg.event.title } : null,
    });
  })
);

/**
 * GET /api/tickets/stats/:eventId — attendance statistics for organizers.
 */
router.get(
  "/stats/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.eventId);
    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const [total, checkedIn] = await Promise.all([
      Registration.count({ where: { event_id: eventId, status: "Confirmed" } }),
      Registration.count({ where: { event_id: eventId, checked_in_at: { [Op.not]: null } } }),
    ]);

    const vipTotal = await Registration.count({ where: { event_id: eventId, ticket_type: "VIP", status: "Confirmed" } });

    res.json({
      eventId,
      eventTitle: event.title,
      totalConfirmed: total,
      checkedIn,
      pending: total - checkedIn,
      attendanceRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
      vipTickets: vipTotal,
    });
  })
);

/**
 * GET /api/tickets/attendees/:eventId — attendee list for organizer management.
 * Supports ?q= search and ?status=checked_in|pending.
 */
router.get(
  "/attendees/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.eventId);
    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const isOrganizer = req.user.role === "admin" || event.organizer_id === req.user.user_id;
    if (!isOrganizer) {
      return res.status(403).json({ success: false, error: "Organizer access required" });
    }

    const where = { event_id: eventId };
    if (req.query.status === "checked_in") where.checked_in_at = { [Op.not]: null };
    if (req.query.status === "pending") where.checked_in_at = null;

    const regs = await Registration.findAll({
      where,
      include: [{ model: User, as: "user", attributes: ["user_id", "name", "email"] }],
      order: [["registration_id", "ASC"]],
    });

    const q = String(req.query.q || "").trim().toLowerCase();
    const rows = regs
      .map((r) => {
        const plain = r.get({ plain: true });
        return {
          registrationId: plain.registration_id,
          ticketCode: plain.ticket_code,
          ticketType: plain.ticket_type || "Regular",
          status: plain.status,
          registeredAt: plain.registration_date,
          checkedInAt: plain.checked_in_at,
          amount: plain.total_amount != null ? Number(plain.total_amount) : null,
          name: plain.user?.name || `User #${plain.user_id}`,
          email: plain.user?.email || "",
        };
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || String(r.ticketCode || "").toLowerCase().includes(q));

    res.json(rows);
  })
);

export default router;
