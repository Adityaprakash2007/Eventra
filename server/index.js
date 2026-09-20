import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { sequelize } from "./models/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Route modules
import eventsRouter from "./routes/events.js";
import usersRouter from "./routes/users.js";
import registrationsRouter from "./routes/registrations.js";
import paymentsRouter from "./routes/payments.js";
import statsRouter from "./routes/stats.js";
import authRouter from "./routes/auth.js";

// ── Config ──────────────────────────────────────────────────
dotenv.config();
const PORT = process.env.PORT || 5000;

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:8080", "http://localhost:5173"], credentials: true }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/users", usersRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/stats", statsRouter);

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

    // Sync models — does NOT alter existing schema
    await sequelize.sync({ alter: false });
    console.log("✅ Models synchronized");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
