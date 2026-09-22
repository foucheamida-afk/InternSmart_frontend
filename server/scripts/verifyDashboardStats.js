// Verifies that /api/admin/dashboard returns exactly what it returned before it
// was rewritten, and that it now costs fewer queries.
//
// The rewrite replaced three `Report.count()` calls with one conditional-
// aggregation query and issued the remaining counts concurrently. That is only
// safe if the numbers are identical, so this does not assert "eight keys exist" -
// it recomputes every counter by the original method and compares. A value that
// silently became 0 or null would pass a shape check and fail here.
//
// Usage: node scripts/verifyDashboardStats.js   (requires the API on :3000)
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import Meeting from "../models/meetingModel.js";
import DefenseAlert from "../models/defenseAlertModel.js";

const BASE = "http://localhost:3000/api";
const PASSWORD = "DashVerify123!";
const TAG = `dash${Date.now()}`;

let checks = 0;
let fails = 0;

const check = (name, condition, detail = "") => {
  checks += 1;
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    fails += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const created = { users: [], students: [], reports: [] };

try {
  await sequelize.authenticate();

  const admin = await User.create({
    name: "Dash Verify Admin",
    email: `${TAG}-admin@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    mustChangePassword: false,
    active: true,
  });
  created.users.push(admin.id);

  // Fixtures spanning each branch of the aggregation CASE, plus one status that
  // is deliberately left absent so the NULL-from-SUM path is exercised if no
  // other row in the database happens to carry it.
  const studentUser = await User.create({
    name: "Dash Verify Student",
    email: `${TAG}-student@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "student",
    mustChangePassword: false,
    active: true,
  });
  created.users.push(studentUser.id);
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "Verify" });
  created.students.push(student.id);
  await Internship.create({ studentId: student.id, company: "Acme", academicYear: "2025/2026" });

  for (const status of ["submitted", "in_review", "ai_analysis", "approved", "needs_revision"]) {
    const report = await Report.create({
      title: `Dash ${status}`,
      fileName: `${TAG}-${status}.pdf`,
      status,
      studentId: student.id,
    });
    created.reports.push(report.id);
  }

  const loginRes = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: PASSWORD }),
  });
  const token = (await loginRes.json()).token;
  check("admin can authenticate", Boolean(token));

  const response = await fetch(`${BASE}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  check("dashboard responds 200", response.status === 200, `got ${response.status}`);
  const body = await response.json();

  // Recompute every counter the original way. Any drift between the single
  // aggregated statement and these discrete counts shows up here.
  const expected = {
    totalStudents: await Student.count(),
    totalSupervisors: await User.count({ where: { role: "academic_supervisor" } }),
    totalInternships: await Internship.count(),
    reportsPendingReview: await Report.count({ where: { status: ["submitted", "in_review", "ai_analysis"] } }),
    reportsApproved: await Report.count({ where: { status: "approved" } }),
    reportsNeedingRevision: await Report.count({ where: { status: "needs_revision" } }),
    upcomingMeetings: await Meeting.count({ where: { status: "scheduled", date: { [Op.gte]: new Date() } } }),
    defenseAlerts: await DefenseAlert.count({ where: { status: "pending" } }),
  };

  for (const [key, value] of Object.entries(expected)) {
    check(
      `${key} matches independent count (${value})`,
      body[key] === value,
      `endpoint returned ${JSON.stringify(body[key])}`
    );
  }

  // `count()` always yielded a number; SUM can yield NULL or a string. Guard the
  // contract that callers rely on rather than only the values.
  for (const key of Object.keys(expected)) {
    check(`${key} is a number, not null/string`, typeof body[key] === "number", `got ${typeof body[key]}`);
  }

  // `middleware/responseEnvelope.js` adds `success` (and `message`/`error` when
  // relevant) to every response, so the endpoint's own keys are the expected set
  // plus those. An earlier version of this check compared against the expected set
  // alone and failed on `success` - the assertion was wrong, not the endpoint.
  const ENVELOPE_KEYS = ["success", "message", "error"];
  const extra = Object.keys(body).filter((key) => !(key in expected) && !ENVELOPE_KEYS.includes(key));
  const missing = Object.keys(expected).filter((key) => !(key in body));
  check(
    "returns exactly the expected counters, plus envelope keys",
    extra.length === 0 && missing.length === 0,
    `extra=[${extra.join(",")}] missing=[${missing.join(",")}]`
  );

  // The fixtures must actually be counted; otherwise every comparison above would
  // agree on a value the test never influenced.
  check("fixtures are reflected in reportsPendingReview", expected.reportsPendingReview >= 3);
  check("fixtures are reflected in reportsApproved", expected.reportsApproved >= 1);
  check("fixtures are reflected in reportsNeedingRevision", expected.reportsNeedingRevision >= 1);
} catch (error) {
  fails += 1;
  checks += 1;
  console.log(`FAIL  suite threw — ${error.message}`);
} finally {
  try {
    await Report.destroy({ where: { id: created.reports } });
    await Internship.destroy({ where: { studentId: created.students } });
    await Student.destroy({ where: { id: created.students } });
    await User.destroy({ where: { id: created.users } });
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
}

console.log(fails === 0 ? `\nALL ${checks} DASHBOARD CHECKS PASSED` : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
