import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const LIBRARY_VISIBILITIES = ["private", "institution", "public"];

// The virtual library: a searchable archive of reports that reached final
// submission (§4.12 phase 3).
//
// One row per *archived version*, not per report. An administrator unlock
// followed by a correction and a fresh submission produces a second archived
// version, and both should remain citable.
//
// The row is a snapshot rather than a set of live foreign keys for the
// descriptive fields. `title`, `companyName` and `academicYear` are copied at
// archive time so that renaming a company or a student's class later does not
// silently rewrite what the archive says was submitted. Only the identifiers
// (`studentId`, supervisor ids, `reportId`) stay as references.
const LibraryEntry = sequelize.define(
  "LibraryEntry",
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

    // Unique: one archive entry per version, so a retry or a double submission
    // cannot produce two entries for the same bytes.
    reportVersionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },

    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // --- descriptive snapshot ------------------------------------------------
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Searchable summary. Student-supplied; the library falls back to the title
    // when absent rather than inventing one.
    abstract: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // JSON array of strings. MariaDB stores JSON as LONGTEXT and the central
    // `afterFind` hook in config/db.js parses it back, so consumers always see
    // an array.
    keywords: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // The academic year the internship belongs to, e.g. "2025/2026". This is the
    // field that makes cross-year comparison possible at all: it is the
    // difference between "this text is similar to something" and "this text is
    // similar to something submitted by a student two cohorts ago".
    academicYear: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    program: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    classLevel: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    companyName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    internshipDomain: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    academicSupervisorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    professionalSupervisorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // --- file ---------------------------------------------------------------
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fileHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // --- integrity ----------------------------------------------------------
    // Populated by the similarity engine (phase 4/5). Deliberately NOT given
    // severity bands here: the threshold values are an open product decision, so
    // the archive stores numbers and leaves classification to configuration.
    finalPlagiarismScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    internalSimilarityScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    externalSimilarityScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    plagiarismStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    submissionDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    // --- access -------------------------------------------------------------
    // private     - the owning student, their supervisors, administrators
    // institution - the above, plus metadata visible to any student in search
    // public      - additionally, the full document readable by students
    //
    // The middle tier is the one that matters for the stated goal: students can
    // discover that a topic was already covered without being handed the full
    // text to reuse.
    visibility: {
      type: DataTypes.ENUM(...LIBRARY_VISIBILITIES),
      allowNull: false,
      defaultValue: "institution",
    },

    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // --- corpus fingerprint (phase 4) ---------------------------------------
    // Computed from the report's text so the internal similarity engine can
    // compare a new report against this one.
    //
    // `corpusSignature` is the MinHash signature used to screen candidates
    // cheaply; `corpusShingles` is the exact shingle set, loaded only for the
    // few candidates that survive screening, so the number shown to a supervisor
    // is an exact overlap rather than an estimate. Both are null until the entry
    // has been indexed, which the engine does lazily.
    corpusSignature: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    corpusShingles: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    corpusWordCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    corpusAlgorithmVersion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    corpusIndexedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    indexes: [
      { fields: ["studentId"] },
      { fields: ["academicYear"] },
      { fields: ["visibility"] },
      { fields: ["companyName"] },
    ],
  }
);

export default LibraryEntry;
