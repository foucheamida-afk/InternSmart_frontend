// Foreign-key audit for the live database.
//
// The SRS has carried this since the original audit: a freshly synced schema
// gets 13 FK constraints, but the running `internSmart` database has fewer,
// because `sync({ force: false })` never alters tables that already exist. The
// gap has been left open deliberately - adding a constraint to a table that
// already contains violating rows fails, and doing it blindly against real data
// is how a schema change turns into an outage.
//
// This audits first and changes nothing: for each expected constraint it reports
// whether it exists, and if not, how many rows would block it. Run with --apply
// to add the ones whose data is clean.
//
// Usage:
//   node scripts/auditForeignKeys.js           # report only
//   node scripts/auditForeignKeys.js --apply   # add the safe ones
import { sequelize } from "../config/db.js";
import "../models/association.js";

const APPLY = process.argv.includes("--apply");

// constraint name -> [child table, column, parent table, referenced column, onDelete]
const EXPECTED = [
  ["students_user", "Students", "userId", "Users", "id", "CASCADE"],
  ["internships_student", "Internships", "studentId", "Students", "id", "CASCADE"],
  ["internships_academic", "Internships", "academicSupervisorId", "Users", "id", "SET NULL"],
  ["internships_professional", "Internships", "professionalSupervisorId", "Users", "id", "SET NULL"],
  ["reports_student", "Reports", "studentId", "Students", "id", "SET NULL"],
  ["meetings_student", "Meetings", "studentId", "Students", "id", "SET NULL"],
  ["meetings_creator", "Meetings", "createdBy", "Users", "id", "CASCADE"],
  ["tasks_student", "Tasks", "studentId", "Students", "id", "CASCADE"],
  ["tasks_supervisor", "Tasks", "supervisorId", "Users", "id", "CASCADE"],
  ["notifications_user", "Notifications", "userId", "Users", "id", "CASCADE"],
  ["defensealerts_student", "DefenseAlerts", "studentId", "Students", "id", "CASCADE"],
  ["reportcomments_report", "ReportComments", "reportId", "Reports", "id", "CASCADE"],
  ["reportcomments_user", "ReportComments", "userId", "Users", "id", "CASCADE"],
];

const q = async (sql, replacements) => {
  const [rows] = await sequelize.query(sql, replacements ? { replacements } : undefined);
  return rows;
};

const existingConstraints = async () => {
  const rows = await q(
    `SELECT TABLE_NAME AS tbl, COLUMN_NAME AS col
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
  );

  // Lower-cased on both sides. MariaDB's information_schema reports table names
  // in the case the filesystem gave them (lowercase here), while this file's
  // expectations are capitalised - comparing them directly silently matched
  // nothing and made the first run of this audit report all 13 as missing when 7
  // already existed. A wrong audit is worse than no audit, because it invites a
  // migration that is not needed.
  //
  // A relationship counts as present if the child table and column are covered,
  // under any constraint name - what matters is the relationship, not its name.
  return new Set(rows.map((r) => `${String(r.tbl).toLowerCase()}.${String(r.col).toLowerCase()}`));
};

const nullTolerant = (onDelete) => onDelete === "SET NULL";

const run = async () => {
  await sequelize.authenticate();
  const covered = await existingConstraints();

  const report = [];

  for (const [name, child, column, parent, parentColumn, onDelete] of EXPECTED) {
    const key = `${child}.${column}`.toLowerCase();
    if (covered.has(key)) {
      report.push({ name, child, column, parent, onDelete, state: "present", orphans: 0 });
      continue;
    }

    // A nullable column tolerates NULL, so those rows are not orphans.
    const nullClause = nullTolerant(onDelete) ? `AND c.\`${column}\` IS NOT NULL` : "";

    const [{ orphans }] = await q(
      `SELECT COUNT(*) AS orphans
         FROM \`${child}\` c
         LEFT JOIN \`${parent}\` p ON c.\`${column}\` = p.\`${parentColumn}\`
        WHERE p.\`${parentColumn}\` IS NULL ${nullClause}`
    );

    report.push({ name, child, column, parent, onDelete, state: "missing", orphans: Number(orphans) });
  }

  console.log("\n  FK constraint audit — live database\n");
  console.log(`  ${"relationship".padEnd(34)} ${"on delete".padEnd(10)} ${"state".padEnd(9)} blockers`);
  console.log(`  ${"-".repeat(70)}`);

  for (const row of report) {
    const label = `${row.child}.${row.column} -> ${row.parent}`;
    console.log(
      `  ${label.padEnd(34)} ${row.onDelete.padEnd(10)} ${row.state.padEnd(9)} ${row.orphans > 0 ? row.orphans : ""}`
    );
  }

  const missing = report.filter((r) => r.state === "missing");
  const blocked = missing.filter((r) => r.orphans > 0);
  const addable = missing.filter((r) => r.orphans === 0);

  console.log(
    `\n  ${report.length - missing.length} present · ${missing.length} missing (${addable.length} safe to add, ${blocked.length} blocked by existing rows)`
  );

  if (blocked.length > 0) {
    console.log("\n  Blocked by data — these need the orphaned rows resolved first, not a schema change:");
    for (const row of blocked) {
      console.log(`    ${row.child}.${row.column}: ${row.orphans} row(s) reference a ${row.parent} that no longer exists`);
    }
  }

  if (!APPLY) {
    console.log("\n  Report only. Re-run with --apply to add the safe constraints.\n");
    return;
  }

  if (addable.length === 0) {
    console.log("\n  Nothing safe to add.\n");
    return;
  }

  console.log("\n  Applying:\n");
  for (const row of addable) {
    try {
      await sequelize.query(
        `ALTER TABLE \`${row.child}\`
           ADD CONSTRAINT \`${row.name}\`
           FOREIGN KEY (\`${row.column}\`) REFERENCES \`${row.parent}\` (\`id\`)
           ON DELETE ${row.onDelete} ON UPDATE CASCADE`
      );
      console.log(`    added  ${row.child}.${row.column} -> ${row.parent} (ON DELETE ${row.onDelete})`);
    } catch (error) {
      // Reported rather than thrown: one failure must not abandon the rest.
      console.log(`    FAILED ${row.child}.${row.column}: ${error.message}`);
    }
  }
  console.log("");
};

try {
  await run();
} catch (error) {
  console.error("FK AUDIT ERROR:", error.message);
} finally {
  await sequelize.close();
}
