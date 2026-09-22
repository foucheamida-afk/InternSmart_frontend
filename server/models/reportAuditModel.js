import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Append-only record of everything that happened to a report.
//
// Integrity rules 10-12 require that approval and submission actions are logged,
// that an administrator cannot silently alter historical marks, and that changes
// create an audit record instead of overwriting history. Those rules cannot be
// satisfied retroactively, so this table exists from the first workflow action
// rather than being added in the audit phase.
//
// There is deliberately no update path: rows are only ever created. `details`
// carries the before/after values so a later change is reconstructable without
// mutating the original row.
const ReportAudit = sequelize.define("ReportAudit", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  reportId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // Which file version the action applied to. Null for report-level events that
  // are not about a specific upload.
  reportVersionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  actorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // The actor's role *as it applied to this action* (academic / professional /
  // student / admin). Recorded rather than derived later, because a person may
  // supervise in both capacities and their primary role would misrepresent what
  // they were doing here.
  actorRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // e.g. submission_requested, review_approved, review_rejected,
  // final_submitted, report_locked, report_unlocked_by_admin
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ["reportId"] },
    { fields: ["actorId"] },
  ],
});

export default ReportAudit;
