import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const DefenseAlert = sequelize.define("DefenseAlert", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  defenseDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("pending", "scheduled", "completed", "cancelled"),
    allowNull: false,
    defaultValue: "pending",
  },
});

export default DefenseAlert;
