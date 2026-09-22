import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// The report lifecycle.
//
// The first six are legacy: they predate the two-stage submission workflow and
// existing rows use them, so they cannot be dropped without a data migration.
// The admin dashboard also counts `submitted`/`in_review`/`ai_analysis` as
// pending review and `needs_revision` as revision-requested, so removing them
// would quietly break those totals.
//
// The remainder are the submission workflow: a student requests review, both
// supervisors must approve before final submission unlocks, and the final
// version is archived into the virtual library.
export const REPORT_STATUSES = [
  // legacy
  "submitted",
  "ai_analysis",
  "in_review",
  "approved",
  "needs_revision",
  "rejected",
  // two-stage submission workflow
  "submission_requested",
  "under_review",
  "rejected_by_academic_supervisor",
  "rejected_by_professional_supervisor",
  "approved_by_one_supervisor",
  "ready_for_final_submission",
  "final_submitted",
  "archived",
];

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
    type: DataTypes.ENUM(...REPORT_STATUSES),
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
  documentContent: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  // --- Submission workflow -------------------------------------------------
  // The file the workflow currently points at. `fileName`/`fileUrl` above are
  // retained as a convenience mirror of the newest version so the existing
  // screens keep working unchanged.
  currentVersionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // Increments each time the student requests review again after corrections.
  // Reviews from a previous cycle remain on record and are ignored by the
  // approval check, which only ever reads the current cycle.
  reviewCycle: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },

  submissionRequestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  finalSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // Set when the final submission lands. From then on the report is immutable
  // and only an administrator may unlock it (integrity rules 6 and 11).
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Report;
