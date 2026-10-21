import { Router } from "express";
import { Payment, Registration, User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/payments — own payments only (admins see all)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user.role === "admin";
    let where = {};
    if (!isAdmin) {
      const regs = await Registration.findAll({
        where: { user_id: req.user.user_id },
        attributes: ["registration_id"],
      });
      where = { registration_id: regs.map((r) => r.registration_id) };
    }

    const payments = await Payment.findAll({
      where,
      include: [
        {
          model: Registration,
          as: "registration",
          attributes: ["registration_id", "user_id"],
          include: [{ model: User, as: "user", attributes: ["user_id", "name"] }],
        },
      ],
      order: [["payment_id", "DESC"]],
    });

    const result = payments.map((p) => {
      const plain = p.get({ plain: true });
      return {
        id: plain.payment_id,
        user: plain.registration?.user?.name || `User #${plain.registration?.user_id || "?"}`,
        amount: Number(plain.amount) || 0,
        method: plain.payment_method || "UPI",
        status: plain.payment_status === "Completed" ? "Paid" : (plain.payment_status || "Pending"),
      };
    });

    res.json(result);
  })
);

// POST /api/payments — pay for your own registration (logged-in users)
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amount, method, status, registrationId } = req.body ?? {};
    if (amount == null || !method) {
      return res.status(400).json({ success: false, error: "amount and method are required" });
    }

    // The paying user is the authenticated user — the registration must belong
    // to them (never trust a user name/id from the request body).
    let registration = null;
    if (registrationId) {
      registration = await Registration.findByPk(registrationId);
    } else {
      registration = await Registration.findOne({
        where: { user_id: req.user.user_id },
        order: [["registration_id", "DESC"]],
      });
    }
    if (!registration) {
      return res
        .status(400)
        .json({ success: false, error: "No registration found. Please register first." });
    }
    if (req.user.role !== "admin" && registration.user_id !== req.user.user_id) {
      return res
        .status(403)
        .json({ success: false, error: "You can only pay for your own registrations" });
    }

    const existingPayment = await Payment.findOne({
      where: { registration_id: registration.registration_id },
    });
    if (existingPayment) {
      return res
        .status(409)
        .json({ success: false, error: "Payment already exists for this registration" });
    }

    const txnId = `TXN${Date.now()}`;
    const payment = await Payment.create({
      registration_id: registration.registration_id,
      payment_method: method,
      payment_status: status === "Paid" ? "Completed" : status || "Pending",
      transaction_id: txnId,
      amount,
    });

    // Mark the registration paid once payment completes.
    if ((status || "Paid") === "Paid") {
      await registration.update({ status: "Confirmed" });
    }

    res.status(201).json({
      id: payment.payment_id,
      user: req.user.name,
      amount: Number(amount),
      method,
      status: status || "Paid",
      registrationId: registration.registration_id,
    });
  })
);

export default router;
