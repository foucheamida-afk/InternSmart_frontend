import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const ANALYSIS_PROVIDERS = ["internal", "copyleaks"];
export const ANALYSIS_TYPES = ["internal", "external", "combined"];
export const ANALYSIS_STATUSES = ["queued", "submitted", "processing", "completed", "failed"];

// One row per plagiarism analysis request.
//
// A report may be analysed more than once - the student revises, a supervisor
// re-runs it, a scan fails and is retried - so this is a history rather than a
// single score on the report. The library entry takes its headline score from
// the newest completed analysis, which is what integrity rule 8 requires: a
// score must be tied to the exact version it was computed from.
//
// `externalScanId` is the vendor's handle for the job. It is the only way to
// correlate an inbound webhook with the row it belongs to, because the webhook
// arrives as an unauthenticated HTTP call carrying nothing but that id.
const PlagiarismAnalysis = sequelize.define(
  "PlagiarismAnalysis",
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

    // The exact file version analysed. An analysis of a superseded version must
    // never be presented as the score for the current one.
    reportVersionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Set when the version has been archived, so a completed analysis can write
    // the headline score straight onto the library entry.
    libraryEntryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    provider: {
      type: DataTypes.ENUM(...ANALYSIS_PROVIDERS),
      allowNull: false,
    },

    analysisType: {
      type: DataTypes.ENUM(...ANALYSIS_TYPES),
      allowNull: false,
      defaultValue: "external",
    },

    status: {
      type: DataTypes.ENUM(...ANALYSIS_STATUSES),
      allowNull: false,
      defaultValue: "queued",
    },

    // Percentages, 0-100. Kept as separate columns rather than one blended
    // number: the user's specification is explicit that internal and external
    // results are independent, and blending them at the storage layer would make
    // that unrecoverable.
    overallScore: { type: DataTypes.FLOAT, allowNull: true },
    internalScore: { type: DataTypes.FLOAT, allowNull: true },
    externalScore: { type: DataTypes.FLOAT, allowNull: true },

    // Severity band derived from the score by configurable thresholds. A label
    // for a reviewer's attention, never a verdict: similarity is not proof of
    // misconduct.
    plagiarismStatus: { type: DataTypes.STRING, allowNull: true },

    // Which sections the exclusion rules discarded before comparison, and how
    // much text that was. Recorded so the effect of the rules is auditable
    // rather than invisible.
    excludedSections: { type: DataTypes.JSON, allowNull: true },

    // The vendor's scan handle. Unique where present so a duplicated submission
    // cannot create two rows for one scan.
    externalScanId: { type: DataTypes.STRING, allowNull: true, unique: true },

    // Counts of matched words, as reported by the vendor's scanned-document
    // summary. Stored raw; interpretation is the thresholds' job.
    totalWords: { type: DataTypes.INTEGER, allowNull: true },
    matchedWords: { type: DataTypes.INTEGER, allowNull: true },

    // The vendor's own summary payload, retained verbatim so a later change to
    // how we interpret results does not lose the original evidence.
    rawSummary: { type: DataTypes.JSON, allowNull: true },

    providerReportUrl: { type: DataTypes.STRING, allowNull: true },

    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    requestedBy: { type: DataTypes.INTEGER, allowNull: true },

    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    indexes: [
      { fields: ["reportId"] },
      { fields: ["reportVersionId"] },
      { fields: ["status"] },
    ],
  }
);

export default PlagiarismAnalysis;
