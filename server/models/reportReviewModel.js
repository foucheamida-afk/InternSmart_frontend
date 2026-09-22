import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const SUPERVISOR_TYPES = ["academic", "professional"];
export const REVIEW_STATUSES = ["pending", "approved", "rejected", "cancelled"];

// One row per supervisor per review cycle.
//
// Two reasons this is a table rather than columns on `Report`:
//
//  1. Approval state belongs to a *pair* of independent reviewers. A single
//     `status` on the report can express "under review" but not "academic said
//     yes, professional has not answered" - and the student's final-submission
//     button hinges on exactly that distinction.
//  2. The confidential supervision mark must never reach a student-facing
//     payload. Keeping it here means the student endpoints can exclude it by
//     simply not selecting this table, instead of remembering to strip a field
//     from the report object on every response. Hiding it only in React would
//     not be a control at all (integrity rule 9).
//
// `cycle` exists so that a rejection invalidates a review round instead of
// overwriting it: the student corrects the report, requests submission again,
// and a new cycle of rows is created while the previous round stays on record.
const ReportReview = sequelize.define(
  "ReportReview",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    reportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // The exact file this verdict applies to. An approval is only meaningful
    // against the bytes it was given (integrity rules 4 and 8).
    reportVersionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    supervisorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    supervisorType: {
      type: DataTypes.ENUM(...SUPERVISOR_TYPES),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(...REVIEW_STATUSES),
      allowNull: false,
      defaultValue: "pending",
    },

    // `cancelled` is set on the *sibling* review when the other supervisor
    // rejects. A rejection ends the round for both reviewers: leaving the second
    // review pending would keep the report in the other supervisor's queue after
    // it had already gone back to the student for correction, and would block the
    // student's next request with "a review is already in progress".

    cycle: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    // Shown to the student: they must know what to correct.
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    requestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Confidential notes about the report. Optional, written on approve, and -
    // like the rejection reason - never returned by a student-facing endpoint.
    privateComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // The rubric grade as it stood when this supervisor approved.
    //
    // A snapshot rather than a live read of `Internship.academicGrade` /
    // `professionalGrade`, for one reason: approval means "I have graded this",
    // and if the grade is changed afterwards the approval it was based on must
    // remain visible. Without this, a later re-grade would silently rewrite what
    // the supervisor actually approved.
    gradeSnapshot: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    indexes: [
      // One verdict per supervisor per cycle. Also the guard against two
      // concurrent approvals creating duplicate rows.
      { unique: true, fields: ["reportId", "cycle", "supervisorType"] },
      { fields: ["supervisorId", "status"] },
    ],
  }
);

export default ReportReview;
