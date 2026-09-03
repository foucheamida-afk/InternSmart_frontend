import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const ReportComment = sequelize.define("ReportComment", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  reportId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  section: { type: DataTypes.STRING(120), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
}, { indexes: [{ fields: ["reportId", "section"] }] });

export default ReportComment;
