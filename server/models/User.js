import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define("user", {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  // ── Profile page (Phase 4) ──────────────────────────────────
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Deterministic avatar tint assigned at signup
  avatar_color: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  // Comma-separated interest categories for recommendations
  interests: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Home location used by recommendations + distance to venues
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
});

export default User;
