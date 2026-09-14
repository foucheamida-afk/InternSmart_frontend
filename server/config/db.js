import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Sequelize } from "sequelize";

// Environment configuration is loaded here as well as in server.js. ES module
// imports are hoisted, so server.js's dotenv.config() runs only *after* this
// module has been evaluated — and the connection below is built at import time.
// The path is resolved from this file rather than process.cwd(), so configuration
// is found regardless of the directory the app is started from.
const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env"
);
dotenv.config({ path: envPath });

const DB_NAME = process.env.DB_NAME || "internSmart";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_DIALECT = process.env.DB_DIALECT || "mysql";

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: DB_DIALECT,
});

// MariaDB implements the JSON type as LONGTEXT, so Sequelize hands JSON columns
// back as raw strings instead of parsed values. Verified against this database:
// Reports.aiAnalysis came back as a 13,949-character string and
// TimelineSettings.milestones as the string "[]", rather than an object/array.
// Native MySQL returns parsed values for the same columns, so consumers had
// started patching around this one at a time (see timelineController's
// parseMilestones), and any consumer that did not - e.g. code doing
// `aiAnalysis.metrics` or `milestones.map(...)` - silently received a string.
//
// Normalising centrally on read means every consumer sees the same shape
// regardless of the underlying engine, and new code cannot reintroduce the bug.
sequelize.addHook("afterFind", (result) => {
  const parseJsonAttributes = (instance) => {
    // Skip plain objects (returned by `raw: true`), which have no model accessors.
    if (!instance || typeof instance.getDataValue !== "function") return;

    const attributes = instance.constructor?.rawAttributes || {};
    for (const [name, definition] of Object.entries(attributes)) {
      if (definition?.type?.key !== "JSON") continue;

      const raw = instance.getDataValue(name);
      if (typeof raw !== "string") continue;

      try {
        instance.setDataValue(name, JSON.parse(raw));
      } catch {
        // Leave unparseable values untouched rather than discarding data.
      }
    }
  };

  if (Array.isArray(result)) result.forEach(parseJsonAttributes);
  else parseJsonAttributes(result);
});

// Strict SQL mode, scoped to THIS app's connections only.
//
// The MariaDB server here runs with sql_mode = NO_ZERO_IN_DATE,NO_ZERO_DATE,
// NO_ENGINE_SUBSTITUTION - it omits STRICT_TRANS_TABLES, so out-of-range and
// over-length values are silently coerced rather than rejected. That was
// observed directly: a 300-character matricule was accepted and stored truncated
// to fit VARCHAR(255), i.e. corrupted data with no error.
//
// Setting it per-connection avoids changing the server-wide default, which would
// affect the other databases hosted on the same instance. Set
// DB_STRICT_MODE=false in .env to opt out.
if (String(process.env.DB_STRICT_MODE ?? "true").toLowerCase() !== "false") {
  sequelize.addHook("afterConnect", async (connection) => {
    const sql = "SET SESSION sql_mode = CONCAT(@@sql_mode, ',STRICT_TRANS_TABLES')";
    try {
      if (typeof connection.promise === "function") {
        await connection.promise().query(sql);
      } else {
        await new Promise((resolve, reject) => {
          connection.query(sql, (error) => (error ? reject(error) : resolve()));
        });
      }
    } catch (error) {
      // Never block startup over this - log it so the setting is not silently absent.
      console.warn("Could not enable STRICT_TRANS_TABLES on this connection:", error.message);
    }
  });
}

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};
