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

// Connection pool sizing.
//
// Previously unspecified, so Sequelize's default of **5** connections was in
// force. That is a hard ceiling on concurrency: every simultaneous request beyond
// five queues for a connection. Making it configurable is worthwhile on its own,
// but be careful about what it does and does not explain.
//
// Measured with scripts/benchmarkEndpoints.js: /api/admin/dashboard answered in
// ~16 ms when requests were issued one at a time, yet 100 simultaneous requests
// took ~1.3 s each in wall-clock terms (~75 req/s). Raising DB_POOL_MAX from 5 to
// 25 changed that figure not at all (~1.33 s vs ~1.31 s), so the pool is *not*
// the binding constraint. The cause was query count per request: the dashboard
// controller issued eight separate `count()` queries one after another, holding
// its connection for the sum of eight round-trips. Collapsing the three report
// counters into one conditional-aggregation statement and issuing the rest
// concurrently took the same burst from ~1333 ms to ~361 ms (~277 req/s) and the
// endpoint's p95 from ~41 ms to ~8 ms. Widening the pool would have moved that
// queue to the database rather than removing it.
//
// The defaults below are exactly the values Sequelize already used, so this
// change alters no existing behaviour - it only makes the ceiling reachable from
// configuration. Each pooled connection is a real MariaDB connection and this
// server's max_connections is 151, shared with any other database on the
// instance, so size it against that limit rather than the target request count.
const poolNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(`${name}="${raw}" is not a valid non-negative number; using ${fallback}.`);
    return fallback;
  }
  return parsed;
};

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: DB_DIALECT,
  pool: {
    max: poolNumber("DB_POOL_MAX", 5),
    min: poolNumber("DB_POOL_MIN", 0),
    acquire: poolNumber("DB_POOL_ACQUIRE_MS", 60000),
    idle: poolNumber("DB_POOL_IDLE_MS", 10000),
  },
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

import mysql from "mysql2/promise";

export const ensureDatabaseExists = async () => {
  try {
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();
    console.log(`Database "${DB_NAME}" verified/created successfully.`);
  } catch (error) {
    console.warn("Could not auto-create database (make sure MySQL service is started in XAMPP Control Panel):", error.message);
  }
};

export const connectDB = async () => {
  try {
    await ensureDatabaseExists();
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    // State the pool ceiling at boot. It is otherwise invisible to callers, and a
    // silent default of 5 is a concurrency limit nobody chose - the kind of thing
    // that only surfaces as unexplained slowness under load.
    console.log(
      `Database pool: max ${sequelize.options.pool.max}, min ${sequelize.options.pool.min}` +
        (process.env.DB_POOL_MAX ? " (DB_POOL_MAX)" : " (default - set DB_POOL_MAX to change)")
    );

    // A Word report is stored as its converted editor content, which is several
    // times the size of the file (embedded images become base64). If the server's
    // packet ceiling is below what the application may store, every large Word
    // upload fails - and it fails as a connection reset, i.e. with no error
    // message at all. Say so here rather than leaving it to be discovered.
    const { warnIfReportsCannotBeStored } = await import("../utils/storedContentLimit.js");
    await warnIfReportsCannotBeStored();
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};
