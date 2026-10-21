import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Star rating (1–5) + optional written review, submitted by a registered
 * attendee after the event has ended. One feedback row per user per event
 * (unique composite index).
 */
const Feedback = sequelize.define("feedback", {
  feedback_id: {
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
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  review: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  indexes: [
    { unique: true, fields: ["event_id", "user_id"], name: "feedback_event_user_uq" },
  ],
});

export default Feedback;
