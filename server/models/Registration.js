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
});

export default Registration;
