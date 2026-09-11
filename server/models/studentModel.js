import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Student = sequelize.define("Student", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },

  matricule: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  class: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  aiRequestsToday: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  aiRequestsDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
});

export default Student;