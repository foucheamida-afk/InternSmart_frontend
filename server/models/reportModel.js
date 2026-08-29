import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Report = sequelize.define("Report", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.ENUM(
      "submitted",
      "ai_analysis",
      "in_review",
      "approved",
      "needs_revision",
      "rejected"
    ),
    allowNull: false,
    defaultValue: "submitted",
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  aiScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  aiAnalysis: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  supervisorFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  supervisorFeedbackBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  supervisorFeedbackAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Report;
