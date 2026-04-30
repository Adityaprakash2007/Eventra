import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Payment = sequelize.define("payment", {
  payment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  registration_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  payment_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
});

export default Payment;
