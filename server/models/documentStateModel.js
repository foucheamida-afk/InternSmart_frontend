import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

/**
 * Persisted Yjs document state for the shared writing workspace.
 *
 * One row per collaborative document (named `report-<id>`). This is the shared
 * source of truth that every connected client syncs through; the JSON blob on the
 * Report row is still written so the existing non-collaborative consumers and the
 * PDF-extraction path keep working unchanged.
 */
const DocumentState = sequelize.define("DocumentState", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  documentName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  // Binary Yjs update payload (LONGBLOB).
  state: {
    type: DataTypes.BLOB("long"),
    allowNull: true,
  },
});

export default DocumentState;
