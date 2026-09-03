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
    allowNull: true,
  },

  professionalSupervisorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  company: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  finalGrade: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },

  gradeBreakdown: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  gradeStatus: {
    type: DataTypes.ENUM("pending", "submitted"),
    allowNull: false,
    defaultValue: "pending",
  },

  gradeSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  gradeSubmittedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  academicGrade: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },

  academicGradeBreakdown: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  academicGradeStatus: {
    type: DataTypes.ENUM("pending", "submitted"),
    allowNull: false,
    defaultValue: "pending",
  },

  academicGradeSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  academicGradeSubmittedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  professionalGrade: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },

  professionalGradeBreakdown: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  professionalGradeStatus: {
    type: DataTypes.ENUM("pending", "submitted"),
    allowNull: false,
    defaultValue: "pending",
  },

  professionalGradeSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  professionalGradeSubmittedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

export default Internship;