import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Ticket = sequelize.define("ticket", {
  ticket_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  event_id: {
    type: DataTypes.INTEGER,
    primaryKey: true, // composite PK
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  quantity_available: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  sale_start: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sale_end: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

// Remove the default 'id' since we have composite PK
Ticket.removeAttribute("id");

export default Ticket;
