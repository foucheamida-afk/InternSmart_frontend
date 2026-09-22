import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const MATCH_SOURCE_TYPES = ["internal", "external"];

// One matched source within an analysis.
//
// "Similarity score 28%" is not on its own actionable, and the module's own
// specification makes the point that a similarity score is not proof of
// misconduct: bibliography, standard definitions, templates and properly quoted
// material all produce matches. A score without its sources cannot be
// interpreted, so the sources are stored rather than only counted.
const PlagiarismMatch = sequelize.define(
  "PlagiarismMatch",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    analysisId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    sourceType: {
      type: DataTypes.ENUM(...MATCH_SOURCE_TYPES),
      allowNull: false,
    },

    // For an internal match: which archived report it matched. Null for a web
    // source.
    sourceReportId: { type: DataTypes.INTEGER, allowNull: true },

    // For an internal match, the cohort the matched report came from. This is
    // the field that makes a match meaningful here - a hit against an earlier
    // academic year is the case the module exists to catch.
    sourceAcademicYear: { type: DataTypes.STRING, allowNull: true },

    sourceUrl: { type: DataTypes.STRING, allowNull: true },
    sourceTitle: { type: DataTypes.STRING, allowNull: true },

    matchedWords: { type: DataTypes.INTEGER, allowNull: true },
    similarityPercentage: { type: DataTypes.FLOAT, allowNull: true },

    // A representative excerpt rather than the whole matched passage: enough for
    // a supervisor to judge whether it is a genuine quotation, without turning
    // this table into a second copy of the corpus.
    matchedText: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    indexes: [
      { fields: ["analysisId"] },
      { fields: ["sourceReportId"] },
    ],
  }
);

export default PlagiarismMatch;
