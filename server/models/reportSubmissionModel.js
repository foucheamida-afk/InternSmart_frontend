import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// The permanent record of a final submission.
//
// Kept separate from `Report` so the evidence of what was submitted survives any
// later change to the report row: the exact version, the file hash as it stood
// at submission, who submitted it, and the plagiarism score the student accepted
// at that moment. Integrity rule 7 requires a permanent hash on every final
// submission, and rule 8 requires a plagiarism result to be tied to a version -
// this row is where those bind together.
//
// A report may in principle be submitted more than once across its life (an
// administrator unlock, followed by a correction and a fresh submission), so
// this is a history rather than a single row.
const ReportSubmission = sequelize.define("ReportSubmission", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  reportId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  reportVersionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // The student's User id, not Student id - this is an actor reference.
  submittedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // SHA-256 of the submitted file. The durable proof of *which* bytes were
  // accepted, retained even if the stored file is later replaced or removed.
  fileHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // The similarity score the student acknowledged at submission. Null until the
  // plagiarism engine (phase 4/5) supplies one.
  acceptedPlagiarismScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },

  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ["reportId"] },
    { fields: ["reportVersionId"] },
  ],
});

export default ReportSubmission;
