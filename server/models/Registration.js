import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Registration = sequelize.define("registration", {
  registration_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  registration_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  // ── QR ticket + attendance (Phase 1) ────────────────────────
  // Unique scannable code, e.g. "EVTR-K7M2XQ4Z8ACD-3F" (see server/lib/tickets.js)
  ticket_code: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  // Ticket class booked: "Regular" | "VIP"
  ticket_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: "Regular",
  },
  // Set by the organizer's QR scanner on first check-in; blocks duplicate entry
  checked_in_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Registration;
