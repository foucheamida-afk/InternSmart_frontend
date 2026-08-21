import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Internship = sequelize.define("Internship", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  academicSupervisorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  professionalSupervisorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  company: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

export default Internship;