import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { sequelize } from "./models/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { seedSampleEvents, ensureEventLocationColumns } from "./seedLocations.js";

// Route modules
import eventsRouter from "./routes/events.js";
import usersRouter from "./routes/users.js";
import registrationsRouter from "./routes/registrations.js";
import paymentsRouter from "./routes/payments.js";
import statsRouter from "./routes/stats.js";
import authRouter from "./routes/auth.js";
import ticketsRouter from "./routes/tickets.js";
import waitlistRouter from "./routes/waitlist.js";
import feedbackRouter from "./routes/feedback.js";
import savedEventsRouter from "./routes/savedEvents.js";
import notificationsRouter from "./routes/notifications.js";
import predictionsRouter from "./routes/predictions.js";
import organizerRouter from "./routes/organizer.js";
import profileRouter from "./routes/profile.js";

// ── Config ──────────────────────────────────────────────────
dotenv.config();
// macOS reserves port 5000 for AirPlay/ControlCenter → default to 5001.
const PORT = parseInt(process.env.PORT || "5001", 10);

const app = express();

// ── Middleware ───────────────────────────────────────────────
// Browser origins allowed to call the API (comma-separated in .env).
const corsOrigin = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/users", usersRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/waitlist", waitlistRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/saved", savedEventsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/predictions", predictionsRouter);
app.use("/api/organizer", organizerRouter);
app.use("/api/profile", profileRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 for unknown API routes
app.use("/api/{*path}", (_req, res) => {
  res.status(404).json({ success: false, error: "API route not found" });
});

// ── Error handler (must be last) ────────────────────────────
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────
async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully");

    // Sync models — does NOT alter existing schema. New columns/tables come
    // from the idempotent upgrade migration (npm run migrate:upgrade).
    await sequelize.sync({ alter: false });
    await import("./migrations/upgradePhase1.js").then((m) => m.runUpgradeMigration());
    console.log("✅ Models synchronized");

    // Safe by default: only seed when the events table is EMPTY (never touches
    // rows created by real users). Explicit control:
    //   npm run seed        → seed now (fills missing generated events)
    //   npm run seed:reset  → dev-only full reseed (wipes + reseeds)
    //   npm run seed:refresh→ drop past-dated generated events, add upcoming ones
    if (process.env.SEED_ON_BOOT === "1") {
      await ensureEventLocationColumns();
      await seedSampleEvents();
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
