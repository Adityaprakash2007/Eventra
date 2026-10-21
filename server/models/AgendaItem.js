import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Event agenda/schedule items shown on the Event Details page.
 * Ordered by item_order within an event.
 */
const AgendaItem = sequelize.define("agenda_item", {
  agenda_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  event_id: {
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
  start_time: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  speaker: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  item_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
}, {
  indexes: [
    { fields: ["event_id", "item_order"], name: "agenda_event_order_idx" },
  ],
});

export default AgendaItem;
