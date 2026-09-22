import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// One immutable row per uploaded file.
//
// This exists because `Report` used to hold `fileName`/`fileUrl`/`documentContent`
// directly, and `submitReport` UPDATED that single row on every re-upload while
// incrementing an integer `version` counter. The previous file reference was
// therefore destroyed on every correction: the version number advanced but the
// version itself was gone, so the report history was unverifiable.
//
// It also makes the integrity rules implementable at all. An approval or a
// plagiarism score has to be tied to an exact file, and "the student changed the
// report after approval" is only detectable if the approved bytes still exist.
const ReportVersion = sequelize.define(
  "ReportVersion",
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

    versionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // SHA-256 of the stored file. Bound into approvals and final submission.
    fileHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fileType: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Extracted plain text for the similarity engine. LONGTEXT rather than TEXT:
    // a report's text routinely exceeds the 64 KB TEXT ceiling and would be
    // silently truncated under STRICT_TRANS_TABLES.
    //
    // Left NULL on upload in this phase; the engine (phase 4) fills it by
    // extracting from the stored file, so the text and the archived bytes cannot
    // drift apart.
    extractedText: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    pageCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    indexes: [
      // A version number must be unique within its report, so a retry or a race
      // cannot produce two "v2" rows.
      { unique: true, fields: ["reportId", "versionNumber"] },
    ],
  }
);

export default ReportVersion;
