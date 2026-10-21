import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Server-persisted notification center rows for a user.
 * Types: registration | ticket | reminder | update | waitlist | payment | system
 */
const Notification = sequelize.define("notification", {
  notification_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: "system",
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  link: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  indexes: [
    { fields: ["user_id", "created_at"], name: "notification_user_created_idx" },
  ],
});

export default Notification;
