import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Event = sequelize.define("event", {
  event_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  organizer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  venue: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  // ── Phase-1 additions ────────────────────────────────────────
  // Banner image URL (falls back to category art on the frontend)
  image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // Optional free-text agenda (structured agenda lives in agenda_item table)
  agenda: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Venue map coordinates for Leaflet embeds + directions
  venue_lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  venue_lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  // Short organizer display name (full profile comes from users table)
  organizer_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  organizer_bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

export default Event;
