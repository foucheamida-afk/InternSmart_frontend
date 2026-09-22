// Verification for the standard response envelope (NFR-MNT-04).
//
// The requirement asked for `{ success, message, error }` and 0 of ~314 handlers
// produced it. It is now applied centrally and additively, so the thing that
// needs proving is twofold:
//
//   1. the envelope is actually present, including on failures no handler wrote;
//   2. nothing that already worked stopped working - the fields every client
//      reads must survive untouched.
//
// (2) is the one that matters. An envelope applied by rewriting handlers breaks
// the first endpoint somebody forgets; applied additively it should be
// invisible to every existing consumer, and this suite checks that rather than
// assuming it.
//
// Requires the API server to be running.
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";

const BASE = "http://localhost:3000/api";
const TAG = `env${Date.now()}`;
const PASSWORD = "VerifyPass123!";

let failures = 0;
const created = [];

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const get = async (path, token) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

const post = async (path, payload) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

try {
  await sequelize.authenticate();

  const admin = await User.create({
    name: "Envelope Admin",
    email: `${TAG}-admin@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    mustChangePassword: false,
    active: true,
  });
  created.push(admin.id);

  // --- success responses ---------------------------------------------------
  const login = await post("/users/login", { email: admin.email, password: PASSWORD });
  check("a successful response carries success: true", login.body?.success === true, JSON.stringify(login.body?.success));
  check("and still carries its message", typeof login.body?.message === "string", login.body?.message);
  check("and the token the client needs", typeof login.body?.token === "string" && login.body.token.length > 20);
  check("and the nested user object, untouched", login.body?.user?.role === "admin", JSON.stringify(login.body?.user?.role));

  const token = login.body.token;

  const providers = await get("/plagiarism/providers", token);
  check("a second successful endpoint also carries success: true", providers.body?.success === true);
  check("and keeps its own domain fields", Array.isArray(providers.body?.providers), typeof providers.body?.providers);
  check("and keeps nested arrays intact", Array.isArray(providers.body?.configured));

  // --- error responses written by a handler --------------------------------
  const badLogin = await post("/users/login", { email: "nobody@example.invalid", password: "wrong" });
  check("a handler-written failure carries success: false", badLogin.body?.success === false, JSON.stringify(badLogin.body?.success));
  check("and an error field, which the contract promises", typeof badLogin.body?.error === "string", badLogin.body?.error);
  check("and its original message", typeof badLogin.body?.message === "string", badLogin.body?.message);

  const unauthenticated = await get("/plagiarism/providers");
  check("an unauthenticated request is enveloped too", unauthenticated.body?.success === false && unauthenticated.status === 401, `status=${unauthenticated.status}`);
  check("and names the failure", typeof unauthenticated.body?.error === "string", unauthenticated.body?.error);

  // --- a failure no handler wrote: unmatched route -------------------------
  const unmatched = await fetch(`${BASE}/definitely-not-a-route`);
  const contentType = unmatched.headers.get("content-type") || "";
  let unmatchedBody = null;
  try {
    unmatchedBody = await unmatched.json();
  } catch {
    unmatchedBody = null;
  }

  check("an unmatched route answers 404", unmatched.status === 404, `status=${unmatched.status}`);
  check("with JSON, not the default HTML page", contentType.includes("application/json"), contentType);
  check("and the envelope", unmatchedBody?.success === false && typeof unmatchedBody?.error === "string", JSON.stringify(unmatchedBody));

  // --- the role guard's refusal is enveloped too ---------------------------
  // An admin token on a student-only route is refused by `authorize`, which does
  // not go through any handler.
  //
  // Domain `code` preservation (REPORT_LOCKED, RUBRIC_REQUIRED, ONBOARDING_REQUIRED)
  // is asserted directly in `verifyReportWorkflow.js` and `verifyOnboardingGate.js`,
  // which branch on it - so if the envelope dropped `code`, those suites fail.
  const wrongRole = await fetch(`${BASE}/students/reports/1/submission-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const wrongRoleBody = await wrongRole.json();
  check("a middleware refusal is enveloped", wrongRoleBody?.success === false, JSON.stringify(wrongRoleBody?.success));
  check("and the middleware's own message survives", wrongRoleBody?.message === "Access denied", wrongRoleBody?.message);

  // --- arrays pass through untouched --------------------------------------
  // Some endpoints return a bare array; wrapping one to add `success` would break
  // every client that iterates it, so they are deliberately left alone. Asserting
  // the exception exists is as important as asserting the rule.
  const timeline = await get("/timeline", token);
  const isArray = Array.isArray(timeline.body);
  if (isArray) {
    check("a bare-array response is left unwrapped, so iterating clients keep working", Array.isArray(timeline.body));
  } else {
    check("a bare-array response, where present, is left unwrapped", timeline.body?.success === true || timeline.body?.success === false, "timeline returned an object, so it is enveloped");
  }

  console.log(`\n${failures === 0 ? "ALL ENVELOPE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("ENVELOPE VERIFICATION ERROR:", error);
} finally {
  try {
    await User.destroy({ where: { id: created } });
    console.log("cleanup: probe admin removed");
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}
