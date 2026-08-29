import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Task = sequelize.define("Task", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  supervisorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("pending", "in_progress", "completed"),
    allowNull: false,
    defaultValue: "pending",
  },
  completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  submissionNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  feedbackAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Task;
