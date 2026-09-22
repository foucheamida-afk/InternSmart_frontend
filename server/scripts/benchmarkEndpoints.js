// Latency measurement for the NFR-PERF targets.
//
// `NFR-PERF-01` requires API responses under 150 ms at up to 500 concurrent
// requests. Those targets have been carried as "Not Verifiable Statically" since
// the original audit, which is true but not useful - the honest position is that
// nothing had measured them. This measures a single-client baseline.
//
// **What this is not:** a load test. It issues requests sequentially from one
// process on the same machine as the database, so it establishes a floor, not a
// ceiling. Passing here does not demonstrate the 500-concurrent-request target,
// and it is reported that way rather than as a pass.
//
// Usage:
//   node scripts/benchmarkEndpoints.js [iterations]
import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Notification from "../models/notificationModel.js";

const BASE = "http://localhost:3000/api";
const ITERATIONS = Math.max(5, Number(process.argv[2]) || 25);
const PASSWORD = "BenchPass123!";
const TAG = `bench${Date.now()}`;

// NFR-PERF-01, and the tighter figures the SRS states for specific operations.
const TARGET_MS = 150;

const created = { users: [], students: [] };

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const login = async (email) => {
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await res.json()).token;
};

const measure = async (label, path, token) => {
  const timings = [];
  let status = 0;

  // One warm-up request, discarded: the first call to an endpoint pays for
  // connection setup and any lazy ORM initialisation, which would otherwise be
  // reported as the typical response time.
  await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  for (let index = 0; index < ITERATIONS; index += 1) {
    const started = process.hrtime.bigint();
    const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    status = res.status;
    // Drain the body: without this the connection is not reusable and the next
    // measurement includes setup cost.
    await res.arrayBuffer();
    timings.push(elapsed);
  }

  timings.sort((a, b) => a - b);

  return {
    label,
    path,
    status,
    p50: percentile(timings, 50),
    p95: percentile(timings, 95),
    max: timings[timings.length - 1],
  };
};

try {
  await sequelize.authenticate();

  const admin = await User.create({
    name: "Bench Admin",
    email: `${TAG}-admin@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    mustChangePassword: false,
    active: true,
  });
  created.users.push(admin.id);

  const studentUser = await User.create({
    name: "Bench Student",
    email: `${TAG}-student@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "student",
    mustChangePassword: false,
    active: true,
  });
  created.users.push(studentUser.id);
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "Benchmark" });
  created.students.push(student.id);
  await Internship.create({ studentId: student.id, company: "Acme", academicYear: "2025/2026" });

  const supervisor = await User.create({
    name: "Bench Supervisor",
    email: `${TAG}-sup@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "academic_supervisor",
    mustChangePassword: false,
    active: true,
    onboardingCompletedAt: new Date(),
  });
  created.users.push(supervisor.id);

  const adminToken = await login(admin.email);
  const studentToken = await login(studentUser.email);
  const supervisorToken = await login(supervisor.email);

  const cases = [
    ["Admin dashboard stats", "/admin/dashboard", adminToken],
    ["Admin user list", "/admin/users?page=1&limit=20", adminToken],
    ["Admin student list", "/admin/students?page=1&limit=20", adminToken],
    ["Student profile", "/students/me", studentToken],
    ["Student dashboard stats", "/students/dashboard-stats", studentToken],
    ["Student reports", "/students/my-reports", studentToken],
    ["Library search", "/library/reports?page=1", studentToken],
    ["Library facets", "/library/facets", studentToken],
    ["Supervisor review queue", "/reviews/pending", supervisorToken],
    ["Timeline read", "/timeline", studentToken],
  ];

  console.log(`\n  Endpoint latency — ${ITERATIONS} iterations each, sequential, single client\n`);
  console.log(`  ${"endpoint".padEnd(28)} ${"status".padEnd(7)} ${"p50".padEnd(9)} ${"p95".padEnd(9)} max`);
  console.log(`  ${"-".repeat(70)}`);

  const results = [];
  for (const [label, path, token] of cases) {
    const result = await measure(label, path, token);
    results.push(result);
    console.log(
      `  ${label.padEnd(28)} ${String(result.status).padEnd(7)} ${`${result.p50.toFixed(1)}ms`.padEnd(9)} ${`${result.p95.toFixed(1)}ms`.padEnd(9)} ${result.max.toFixed(1)}ms`
    );
  }

  const over = results.filter((r) => r.p95 > TARGET_MS);

  console.log(
    `\n  ${results.length - over.length}/${results.length} endpoints within the ${TARGET_MS} ms p95 target` +
      (over.length ? ` — over: ${over.map((r) => r.label).join(", ")}` : "")
  );

  // Concurrency phase. The target is stated in terms of concurrent requests, so
  // a sequential baseline cannot speak to it at all. This fires a burst of
  // simultaneous requests and records whether the server degrades or errors -
  // which is the actual failure mode worth knowing about.
  const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY) || 100;
  const burstPath = "/admin/dashboard";

  // The connection pool of *this script's* process, not the server's. That
  // distinction matters: an earlier version of this script printed this number
  // next to the burst result, where it reads as the server's pool size and
  // invites the wrong conclusion. The server's pool is not observable from a
  // client at all - check its boot log, which now reports it.
  const [poolRow] = await sequelize.query("SELECT @@max_connections AS maxConnections");
  const poolMax = sequelize.options.pool?.max ?? "unknown";

  const burst = async (path, token) => {
    const started = process.hrtime.bigint();
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        try {
          const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
          await res.arrayBuffer();
          return res.status;
        } catch (error) {
          return error.cause?.code || "FETCH_FAILED";
        }
      })
    );
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    return { elapsed, responses };
  };

  console.log(`\n  Concurrency burst — ${CONCURRENCY} simultaneous requests to ${burstPath}\n`);

  // Two rounds: the first is discarded so the figure is not dominated by
  // cold-start connection establishment.
  await burst(burstPath, adminToken);
  const { elapsed, responses } = await burst(burstPath, adminToken);

  const counts = responses.reduce((acc, status) => ({ ...acc, [status]: (acc[status] || 0) + 1 }), {});
  const failures = responses.filter((s) => s !== 200).length;

  console.log(`  total elapsed  ${elapsed.toFixed(0)} ms`);
  console.log(`  throughput     ${((CONCURRENCY / elapsed) * 1000).toFixed(0)} req/s`);
  console.log(`  status codes   ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join("  ")}`);
  console.log(`  errors         ${failures}`);
  console.log(`  db pool max    ${poolMax}   server max_connections ${poolRow[0].maxConnections}`);

  console.log(
    "\n  Scope: requests originate from one client process on the same host as the" +
      `\n  database, so these figures are a floor. ${CONCURRENCY} concurrent requests is not the` +
      "\n  NFR-PERF-01 target of 500, and a single-process client cannot saturate the" +
      "\n  server the way 500 independent clients would. Read the burst as evidence that" +
      "\n  the server does not error or collapse under concurrency — not as a pass." +
      "\n  The burst reuses one authenticated account; real traffic would include login" +
      "\n  and bcrypt verification cost, which is deliberately excluded here.\n"
  );
} catch (error) {
  console.error("BENCHMARK ERROR:", error);
} finally {
  try {
    await Notification.destroy({ where: { userId: created.users } });
    await Internship.destroy({ where: { studentId: created.students } });
    await Student.destroy({ where: { id: created.students } });
    await User.destroy({ where: { id: created.users } });
    console.log("cleanup: benchmark accounts removed");
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
}
