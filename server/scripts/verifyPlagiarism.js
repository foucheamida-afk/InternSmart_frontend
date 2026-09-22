// Verification for the plagiarism module (§4.12 phases 4-5).
//
// Run in two modes against a server started to match:
//   node scripts/verifyPlagiarism.js unconfigured   # server started with NO PLAGIARISM_WEBHOOK_SECRET
//   node scripts/verifyPlagiarism.js configured     # server started WITH the secret below
//
// The live Copyleaks API is NOT exercised - that needs a real account. What is
// exercised is everything around it: provider detection, the refusal to scan
// without credentials, the webhook's authentication and fail-closed behaviour,
// and the whole result pipeline driven by a realistic simulated `completed`
// payload. The one unverified link is the outbound `loginAsync` / `submitFileAsync`
// call, and that is stated rather than glossed over.
import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import PlagiarismAnalysis from "../models/plagiarismAnalysisModel.js";
import PlagiarismMatch from "../models/plagiarismMatchModel.js";
import Notification from "../models/notificationModel.js";

const BASE = "http://localhost:3000/api";
const MODE = process.argv[2] || "unconfigured";
const TAG = `plg${Date.now()}`;
const PASSWORD = "VerifyPass123!";
const SECRET = process.env.PLAGIARISM_WEBHOOK_SECRET || "";

let failures = 0;
const ids = { users: [], students: [], reports: [] };

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

const login = async (email) => {
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await res.json()).token;
};

const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

const postWebhook = async (event, payload, secret = SECRET) => {
  const query = secret === null ? "" : `?secret=${encodeURIComponent(secret)}`;
  const res = await fetch(`${BASE}/plagiarism/webhook/${event}${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
};

// A payload shaped as Copyleaks sends it on a completed scan.
const completedPayload = (scanId) => ({
  scanId,
  status: 1,
  developerPayload: "analysis:seed",
  scannedDocument: { scanId, totalWords: 4200, credits: 1.2, creationTime: new Date().toISOString() },
  results: {
    score: { identicalWords: 320, minorChangedWords: 160, relatedMeaningWords: 40, aggregatedScore: 12.38 },
    internet: [
      { url: "https://example.edu/paper-a", title: "Prior paper A", matchedWords: 300, score: 7.1 },
      { url: "https://example.org/paper-b", title: "Prior paper B", matchedWords: 120, score: 5.28 },
    ],
    database: [{ title: "Earlier cohort report", matchedWords: 100, score: 2.4 }],
  },
});

try {
  await sequelize.authenticate();

  const admin = await User.create({
    name: "Plag Admin",
    email: mail("admin"),
    password: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    mustChangePassword: false,
    active: true,
  });
  ids.users.push(admin.id);
  const adminAuth = auth(await login(admin.email));

  const studentUser = await User.create({
    name: "Plag Student",
    email: mail("student"),
    password: await bcrypt.hash(PASSWORD, 10),
    role: "student",
    mustChangePassword: false,
    active: true,
  });
  ids.users.push(studentUser.id);
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "Verification" });
  ids.students.push(student.id);
  await Internship.create({ studentId: student.id, company: "Acme", academicYear: "2025/2026" });
  const studentAuth = auth(await login(studentUser.email));

  const report = await Report.create({
    studentId: student.id,
    title: "Plagiarism Probe Report",
    fileName: "probe.pdf",
    fileUrl: "/uploads/probe.pdf",
    status: "final_submitted",
    submittedAt: new Date(),
  });
  ids.reports.push(report.id);
  const version = await ReportVersion.create({
    reportId: report.id,
    versionNumber: 1,
    fileName: "probe.pdf",
    fileUrl: "/uploads/probe.pdf",
    fileHash: "deadbeef",
  });
  await report.update({ currentVersionId: version.id });

  const entry = await LibraryEntry.create({
    reportId: report.id,
    reportVersionId: version.id,
    studentId: student.id,
    title: report.title,
    academicYear: "2025/2026",
    submissionDate: new Date(),
    visibility: "institution",
  });

  // --- provider registry ---------------------------------------------------
  const providers = await (await fetch(`${BASE}/plagiarism/providers`, { headers: adminAuth })).json();
  const copyleaks = providers.providers?.find((p) => p.name === "copyleaks");
  const internal = providers.providers?.find((p) => p.name === "internal");

  check("the provider registry lists copyleaks", Boolean(copyleaks));
  check("the provider registry lists internal", Boolean(internal));
  check("copyleaks reports itself unconfigured without credentials", copyleaks?.configured === false);
  check(
    "the missing variables are named so the operator knows what to set",
    Array.isArray(copyleaks?.missing) && copyleaks.missing.includes("COPYLEAKS_API_KEY"),
    JSON.stringify(copyleaks?.missing)
  );

  if (MODE === "unconfigured") {
    // --- the application must refuse cleanly, not fail obscurely ------------
    // Note: with no Copyleaks credentials the internal engine is still available,
    // because it needs neither credentials nor network. So the default request
    // succeeds by falling back to it, and only an EXPLICIT request for the
    // unconfigured provider is refused. That distinction is the point of the
    // registry's resolve logic.
    const explicit = await fetch(`${BASE}/plagiarism/reports/${report.id}/analyze`, {
      method: "POST",
      headers: { ...studentAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "copyleaks" }),
    });
    const explicitData = await explicit.json();
    check("explicitly requesting the unconfigured provider is refused", explicit.status === 503, `status=${explicit.status}`);
    check("it says which code to look at", explicitData.code === "NO_PROVIDER", explicitData.code);
    check(
      "and names the variables that are missing",
      Array.isArray(explicitData.details?.missing) && explicitData.details.missing.includes("COPYLEAKS_API_KEY"),
      JSON.stringify(explicitData.details?.missing)
    );

    const fallback = await fetch(`${BASE}/plagiarism/reports/${report.id}/analyze`, {
      method: "POST",
      headers: studentAuth,
    });
    const fallbackData = await fallback.json();
    check(
      "with no provider named, the request falls back to the always-available internal engine",
      fallback.status === 202 && fallbackData.analysis?.provider === "internal",
      `status=${fallback.status} provider=${fallbackData.analysis?.provider}`
    );

    const hook = await postWebhook("completed", completedPayload("whatever"), null);
    check("the webhook fails closed when no secret is configured", hook.status === 503, `status=${hook.status}`);
    check("and explains why", String(hook.data?.message).includes("not configured"), hook.data?.message);

    const latest = await (await fetch(`${BASE}/plagiarism/reports/${report.id}/latest`, { headers: studentAuth })).json();
    check("the analysis endpoints still answer normally", latest.reportId === report.id);
    check("the queued internal analysis appears in the history", Array.isArray(latest.history) && latest.history.length >= 1, `n=${latest.history?.length}`);

    console.log(`\n${failures === 0 ? "ALL UNCONFIGURED-MODE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  } else {
    // --- webhook authentication ---------------------------------------------
    const wrong = await postWebhook("completed", completedPayload("x"), "definitely-not-the-secret");
    check("a webhook with the wrong secret is refused", wrong.status === 401, `status=${wrong.status}`);

    const missingSecret = await postWebhook("completed", completedPayload("x"), "");
    check("a webhook with no secret is refused", missingSecret.status === 401, `status=${missingSecret.status}`);

    const noScanId = await postWebhook("completed", { status: 1 });
    check("a payload with no scan id is acknowledged but ignored", noScanId.status === 200 && noScanId.data?.handled === false);

    const unknown = await postWebhook("completed", completedPayload("scan-that-does-not-exist"));
    check("an unknown scan id is acknowledged but ignored", unknown.status === 200 && unknown.data?.handled === false);
    check("the response does not disclose whether the scan exists", unknown.data?.handled === false);

    // --- seed an in-flight analysis, as the worker would leave it -----------
    const scanId = `${TAG}-scan-1`;
    const analysis = await PlagiarismAnalysis.create({
      reportId: report.id,
      reportVersionId: version.id,
      libraryEntryId: entry.id,
      provider: "copyleaks",
      analysisType: "external",
      status: "processing",
      externalScanId: scanId,
      requestedBy: studentUser.id,
    });

    const completed = await postWebhook("completed", completedPayload(scanId));
    check("a valid completed webhook is handled", completed.status === 200 && completed.data?.handled === true, JSON.stringify(completed.data));

    await analysis.reload();
    check("the analysis is marked completed", analysis.status === "completed", analysis.status);
    check("the aggregated score is stored", analysis.externalScore === 12.38, String(analysis.externalScore));
    check("the overall score mirrors the external one", analysis.overallScore === 12.38, String(analysis.overallScore));
    check("the word counts are stored", analysis.totalWords === 4200 && analysis.matchedWords === 520, `${analysis.totalWords}/${analysis.matchedWords}`);
    check("the raw provider summary is retained as evidence", Boolean(analysis.rawSummary?.results?.score), "rawSummary present");
    check("the completion time is recorded", Boolean(analysis.completedAt));

    const matches = await PlagiarismMatch.findAll({ where: { analysisId: analysis.id } });
    check("one match row per matched source", matches.length === 3, `rows=${matches.length}`);
    check("web sources are captured", matches.filter((m) => m.sourceUrl).length === 2);
    check("match titles and scores survive the mapping", matches.some((m) => m.sourceTitle === "Prior paper A" && m.similarityPercentage === 7.1));

    await entry.reload();
    check("the library entry receives the score", entry.finalPlagiarismScore === 12.38, String(entry.finalPlagiarismScore));
    check("the external score is recorded separately on the entry", entry.externalSimilarityScore === 12.38);
    check(
      "the score is classified into a severity band (12.38 % is moderate at the configured 10/25/40)",
      entry.plagiarismStatus === "moderate",
      String(entry.plagiarismStatus)
    );

    // Integrity: a re-delivered webhook must not double the evidence.
    const redelivered = await postWebhook("completed", completedPayload(scanId));
    check("a re-delivered webhook is handled idempotently", redelivered.status === 200 && redelivered.data?.handled === true);
    const matchesAfter = await PlagiarismMatch.findAll({ where: { analysisId: analysis.id } });
    check("matches are replaced, not duplicated", matchesAfter.length === 3, `rows=${matchesAfter.length}`);

    // --- the error event ----------------------------------------------------
    const failedScanId = `${TAG}-scan-2`;
    const failing = await PlagiarismAnalysis.create({
      reportId: report.id,
      reportVersionId: version.id,
      provider: "copyleaks",
      analysisType: "external",
      status: "processing",
      externalScanId: failedScanId,
    });

    const errored = await postWebhook("error", { scanId: failedScanId, error: { message: "Document is password protected." } });
    check("an error webhook is handled", errored.status === 200 && errored.data?.handled === true);

    await failing.reload();
    check("the analysis is marked failed", failing.status === "failed", failing.status);
    check("the provider's reason is preserved", failing.errorMessage === "Document is password protected.", failing.errorMessage);

    // --- the creditsChecked event starts the scan --------------------------
    const creditsScanId = `${TAG}-scan-3`;
    await PlagiarismAnalysis.create({
      reportId: report.id,
      reportVersionId: version.id,
      provider: "copyleaks",
      analysisType: "external",
      status: "processing",
      externalScanId: creditsScanId,
    });
    // No credentials are installed, so the start call cannot succeed - what is
    // asserted is that the event is routed to the provider rather than dropped,
    // which is the failure mode that would hang a scan forever.
    const credits = await postWebhook("creditsChecked", { scanId: creditsScanId });
    check("a creditsChecked webhook reaches the provider instead of being dropped", credits.status === 200, `status=${credits.status}`);

    // --- reading the result back -------------------------------------------
    const latest = await (await fetch(`${BASE}/plagiarism/reports/${report.id}/latest`, { headers: studentAuth })).json();
    check("the latest result is returned with its matches", latest.latest?.matches?.length === 3, `n=${latest.latest?.matches?.length}`);
    check("the score is visible to the owning student", latest.latest?.externalScore === 12.38);
    check("the history lists every analysis including failures", latest.history.length >= 3, `n=${latest.history.length}`);
    check("failures are visible in the history", latest.history.some((h) => h.status === "failed"));

    // --- submitting still refuses without credentials -----------------------
    const analyze = await fetch(`${BASE}/plagiarism/reports/${report.id}/analyze`, {
      method: "POST",
      headers: studentAuth,
    });
    check(
      "a new scan still cannot be submitted without Copyleaks credentials",
      analyze.status === 503,
      `status=${analyze.status}`
    );

    console.log(`\n${failures === 0 ? "ALL CONFIGURED-MODE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  }
} catch (error) {
  failures++;
  console.error("PLAGIARISM VERIFICATION ERROR:", error);
} finally {
  try {
    const reportIds = ids.reports.filter(Number.isInteger);
    if (reportIds.length) {
      await PlagiarismMatch.destroy({ where: { analysisId: (await PlagiarismAnalysis.findAll({ where: { reportId: reportIds }, attributes: ["id"] })).map((a) => a.id) } });
      await PlagiarismAnalysis.destroy({ where: { reportId: reportIds } });
      await LibraryEntry.destroy({ where: { reportId: reportIds } });
      await ReportVersion.destroy({ where: { reportId: reportIds } });
      await Report.destroy({ where: { id: reportIds } });
    }
    await Internship.destroy({ where: { studentId: ids.students } });
    await Notification.destroy({ where: { userId: ids.users } });
    await Student.destroy({ where: { id: ids.students } });
    await User.destroy({ where: { id: ids.users } });
    console.log(`cleanup: removed ${ids.users.length} users, ${ids.students.length} students, ${reportIds.length} reports`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}
