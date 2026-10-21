import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

/** Events a user bookmarked / saved for later ("Save event" button). */
const SavedEvent = sequelize.define("saved_event", {
  saved_id: {
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
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  indexes: [
    { unique: true, fields: ["event_id", "user_id"], name: "saved_event_event_user_uq" },
  ],
});

export default SavedEvent;
