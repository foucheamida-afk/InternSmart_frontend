import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const TimelineSetting = sequelize.define("TimelineSetting", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  milestones: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

export default TimelineSetting;
