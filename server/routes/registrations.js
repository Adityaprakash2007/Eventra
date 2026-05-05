import { Router } from "express";
import { Registration, Event, User, Ticket } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// GET /api/registrations — list all registrations
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const registrations = await Registration.findAll({
      include: [
        { model: Event, as: "event", attributes: ["event_id", "title"] },
        { model: User, as: "user", attributes: ["user_id", "name"] },
      ],
      order: [["registration_id", "DESC"]],
    });

    const result = registrations.map((r) => {
      const plain = r.get({ plain: true });
      return {
        id: plain.registration_id,
        user: plain.user?.name || `User #${plain.user_id}`,
        eventId: plain.event_id,
        ticket: "Regular", // ticket type comes from ticket table; default to Regular
        status: plain.status || "Pending",
        event: plain.event ? { id: plain.event.event_id, title: plain.event.title } : null,
      };
    });

    res.json(result);
  })
);

// POST /api/registrations — create a registration
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { user, eventId, ticket } = req.body;
    if (!user || !eventId) {
      return res.status(400).json({ success: false, error: "user and eventId are required" });
    }

    // Verify event exists
    const event = await Event.findByPk(eventId, {
      include: [{ model: Ticket, as: "tickets" }],
    });
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    // Find user by name — auto-create if not found
    let existingUser = await User.findOne({ where: { name: user } });
    if (!existingUser) {
      existingUser = await User.create({
        name: user,
        email: `${user.toLowerCase().replace(/\s+/g, ".")}@guest.eventflow.app`,
        password: "guest",
        role: "attendee",
      });
    }
    const userId = existingUser.user_id;

    // Calculate amount from ticket price
    const tickets = event.get({ plain: true }).tickets || [];
    const ticketPrice = tickets.length > 0 ? Number(tickets[0].price) : 0;
    const amount = (ticket === "VIP" ? ticketPrice * 2 : ticketPrice);

    const registration = await Registration.create({
      user_id: userId,
      event_id: eventId,
      status: "Confirmed",
      total_amount: amount,
    });

    res.status(201).json({
      id: registration.registration_id,
      user,
      eventId: Number(eventId),
      ticket: ticket || "Regular",
      status: "Confirmed",
    });
  })
);

export default router;
