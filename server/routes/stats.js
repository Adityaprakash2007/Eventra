import { Router } from "express";
import { literal } from "sequelize";
import { Event, User, Registration, Payment } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// GET /api/stats — dashboard summary stats
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [totalUsers, totalEvents, totalRegistrations, revenueResult] = await Promise.all([
      User.count(),
      Event.count(),
      Registration.count(),
      Payment.sum("amount", { where: { payment_status: "Completed" } }),
    ]);

    res.json({
      totalUsers,
      totalEvents,
      totalRegistrations,
      totalRevenue: Number(revenueResult) || 0,
    });
  })
);

// GET /api/stats/registrations-per-event — chart data
router.get(
  "/registrations-per-event",
  asyncHandler(async (_req, res) => {
    const events = await Event.findAll({
      attributes: [
        "event_id",
        "title",
        [
          literal(`(SELECT COUNT(*) FROM registration WHERE registration.event_id = event.event_id)`),
          "reg_count",
        ],
      ],
      order: [["event_id", "ASC"]],
    });

    const data = events.map((e) => ({
      name: e.getDataValue("title").split(" ")[0],
      registrations: parseInt(e.getDataValue("reg_count") || "0", 10),
    }));

    res.json(data);
  })
);

export default router;
