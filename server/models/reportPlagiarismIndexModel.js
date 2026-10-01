import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Dedicated table for internal plagiarism fingerprinting and MinHash shingle indexing.
//
// Separating corpus index data from LibraryEntry keeps the virtual library lightweight
// for search/browsing queries while maintaining exact plagiarism index persistence.
const ReportPlagiarismIndex = sequelize.define(
  "ReportPlagiarismIndex",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    reportVersionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },

    libraryEntryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // MinHash signature array used for fast candidate screening
    corpusSignature: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // Map/Set of 5-word shingle hashes used for exact similarity pass
    corpusShingles: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    corpusWordCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    algorithmVersion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    indexedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "ReportPlagiarismIndexes",
    indexes: [
      { unique: true, fields: ["reportVersionId"] },
      { fields: ["libraryEntryId"] },
    ],
  }
);

export default ReportPlagiarismIndex;
