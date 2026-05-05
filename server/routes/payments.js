import { Router } from "express";
import { Payment, Registration, User } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// GET /api/payments — list all payments
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const payments = await Payment.findAll({
      include: [{
        model: Registration,
        as: "registration",
        attributes: ["registration_id", "user_id"],
        include: [{ model: User, as: "user", attributes: ["user_id", "name"] }],
      }],
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

// POST /api/payments — create a payment
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { user, amount, method, status, registrationId: reqRegId } = req.body;
    if (!user || amount == null || !method) {
      return res.status(400).json({ success: false, error: "user, amount, and method are required" });
    }

    let registrationId = reqRegId || null;

    // If no registrationId was passed, look it up by user name
    if (!registrationId) {
      const existingUser = await User.findOne({ where: { name: user } });
      if (existingUser) {
        const reg = await Registration.findOne({
          where: { user_id: existingUser.user_id },
          order: [["registration_id", "DESC"]],
        });
        if (reg) registrationId = reg.registration_id;
      }
    }

    if (!registrationId) {
      return res.status(400).json({ success: false, error: "No registration found for this user. Please register first." });
    }

    // Check if payment already exists for this registration
    const existingPayment = await Payment.findOne({ where: { registration_id: registrationId } });
    if (existingPayment) {
      return res.status(400).json({ success: false, error: "Payment already exists for this registration" });
    }

    const txnId = `TXN${Date.now()}`;
    const payment = await Payment.create({
      registration_id: registrationId,
      payment_method: method,
      payment_status: status === "Paid" ? "Completed" : (status || "Pending"),
      transaction_id: txnId,
      amount,
    });

    res.status(201).json({
      id: payment.payment_id,
      user,
      amount: Number(amount),
      method,
      status: status || "Paid",
    });
  })
);

export default router;
