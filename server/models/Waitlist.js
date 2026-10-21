import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Waitlist entries for sold-out events. Position is derived from
 * waitlist_id ordering per event; joined_at preserves fair ordering.
 * Status: "waiting" → "promoted" | "cancelled" | "expired"
 */
const Waitlist = sequelize.define("waitlist", {
  waitlist_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "waiting",
  },
  joined_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  promoted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    { unique: true, fields: ["event_id", "user_id"], name: "waitlist_event_user_uq" },
  ],
});

export default Waitlist;
