// Verification for the internal similarity engine (§4.12 phase 4).
// Requires the API server to be running.
//
// Builds two archived reports where the second reuses most of the first, then
// asks the engine to compare them. The reuse is deliberate and measurable, so
// the assertions are about real behaviour rather than the response shape.
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
import ReportPlagiarismIndex from "../models/reportPlagiarismIndexModel.js";
import Notification from "../models/notificationModel.js";

const BASE = "http://localhost:3000/api";
const TAG = `int${Date.now()}`;
const PASSWORD = "VerifyPass123!";

const ids = { users: [], students: [], reports: [] };
let failures = 0;

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

// A distinctive passage. Deliberately long enough to produce many 5-word
// shingles, and written so that ordinary boilerplate cannot explain a match.
const REUSED = [
  "the internship was carried out at the company research division where the primary objective involved",
  "designing and implementing a distributed telemetry pipeline capable of ingesting roughly forty thousand",
  "events per second while maintaining a bounded end to end latency budget across three availability zones",
  "the pipeline was decomposed into an ingestion tier a normalisation tier and a durable append only storage tier",
  "each tier was independently scalable and communicated exclusively through a partitioned commit log which allowed",
  "replay of historical traffic for regression testing and deterministic reproduction of production incidents",
  "particular attention was paid to backpressure because unbounded queue growth during a downstream outage was",
  "identified as the dominant failure mode in the legacy system and a credit based flow control scheme was adopted",
];

const ORIGINAL_ONLY = [
  "the evaluation was conducted over a twelve week period using a synthetic workload derived from anonymised",
  "production traces and the observed throughput remained within nine percent of the modelled capacity throughout",
];

const COPIED_ONLY = [
  "finally the report concludes that incremental delivery of observability instrumentation alongside each tier",
  "reduced the mean time to diagnosis substantially compared with the previous monolithic deployment strategy",
];

// An identical reference list in both reports. This is the material exclusion
// rules exist for: it is *supposed* to match, and counting it would inflate the
// apparent similarity between two reports that share nothing else.
const REFERENCES_HEADING = "References";
const REFERENCES = [
  "kleppmann m 2017 designing data intensive applications oreilly media sebastopol",
  "kreps j narkhede n and rao j 2011 kafka a distributed messaging system for log processing",
  "shapiro m and preguiça n 2019 conflict free replicated data types for distributed systems",
];

const TREE = (paragraphs) => ({
  type: "doc",
  content: paragraphs.map((paragraph) => ({
    type: "paragraph",
    content: [{ type: "text", text: paragraph }],
  })),
});

const buildStudent = async (label) => {
  const supervisorUser = await User.create({
    name: `${label} Supervisor`,
    email: mail(`${label}-sup`),
    password: await bcrypt.hash(PASSWORD, 10),
    role: "academic_supervisor",
    mustChangePassword: false,
    active: true,
    onboardingCompletedAt: new Date(),
  });
  ids.users.push(supervisorUser.id);

  const user = await User.create({
    name: `${label} Student`,
    email: mail(label),
    password: await bcrypt.hash(PASSWORD, 10),
    role: "student",
    mustChangePassword: false,
    active: true,
    onboardingCompletedAt: new Date(),
  });
  ids.users.push(user.id);

  const student = await Student.create({
    userId: user.id,
    matricule: `M-${TAG}-${label}`,
    class: "Verification",
  });
  ids.students.push(student.id);

  await Internship.create({
    studentId: student.id,
    company: "Acme",
    academicYear: "2025/2026",
    academicSupervisorId: supervisorUser.id,
  });

  const supervisorToken = await login(supervisorUser.email);

  return { user, student, auth: auth(await login(user.email)), supervisorAuth: auth(supervisorToken) };
};

// An archived report: a Report + version + library entry, with the text stored
// the way the upload path stores it (an editor tree on the report).
const archiveReport = async (ctx, title, paragraphs, academicYear) => {
  const report = await Report.create({
    studentId: ctx.student.id,
    title,
    fileName: `${title}.pdf`,
    fileUrl: `/uploads/${TAG}-${title.replace(/\s+/g, "-")}.pdf`,
    status: "final_submitted",
    submittedAt: new Date(),
    documentContent: TREE(paragraphs),
  });
  ids.reports.push(report.id);

  const version = await ReportVersion.create({
    reportId: report.id,
    versionNumber: 1,
    fileName: `${title}.pdf`,
    fileUrl: report.fileUrl,
    fileHash: `hash-${report.id}`,
  });
  await report.update({ currentVersionId: version.id, lockedAt: new Date(), finalSubmittedAt: new Date() });

  const entry = await LibraryEntry.create({
    reportId: report.id,
    reportVersionId: version.id,
    studentId: ctx.student.id,
    title,
    academicYear,
    submissionDate: new Date(),
    visibility: "institution",
  });

  return { report, version, entry };
};

try {
  await sequelize.authenticate();

  const earlier = await buildStudent("earlier");
  const later = await buildStudent("later");
  const unrelated = await buildStudent("unrelated");

  // The corpus: one report from an earlier cohort. Includes a reference list.
  const archived = await archiveReport(
    earlier,
    "Telemetry Pipeline",
    REUSED.concat(ORIGINAL_ONLY, [REFERENCES_HEADING], REFERENCES),
    "2023/2024"
  );

  // A genuinely unrelated report, so the engine is not merely finding the only
  // other document it has.
  const unrelatedReport = await archiveReport(
    unrelated,
    "Agricultural Survey",
    [
      "the survey covered twelve smallholder cooperatives across two administrative divisions during the dry season",
      "yield measurements were collected weekly and cross checked against cooperative ledger records where available",
      "soil samples were analysed for nitrogen phosphorus and potassium content at a regional laboratory facility",
    ],
    "2024/2025"
  );

  // The submitted report: reuses the earlier passage, adds its own conclusion,
  // and carries the same reference list.
  const submitted = await archiveReport(
    later,
    "Distributed Telemetry",
    REUSED.concat(COPIED_ONLY, [REFERENCES_HEADING], REFERENCES),
    "2025/2026"
  );

  // --- run the engine ------------------------------------------------------
  const request = await fetch(`${BASE}/plagiarism/reports/${submitted.report.id}/analyze`, {
    method: "POST",
    headers: later.supervisorAuth,
    body: JSON.stringify({ provider: "internal" }),
  });
  const requested = await request.json();
  check("an internal analysis can be requested", request.status === 202 || request.status === 200, `status=${request.status} ${requested.message || ""}`);

  if (!requested?.analysis?.id) {
    throw new Error(`Could not queue the analysis: ${JSON.stringify(requested)}`);
  }

  // The worker is kicked immediately by the endpoint; poll briefly for it.
  let analysis = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    analysis = await PlagiarismAnalysis.findByPk(requested.analysis.id);
    if (analysis?.status === "completed" || analysis?.status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  check("the internal analysis completes without a webhook", analysis?.status === "completed", `status=${analysis?.status} ${analysis?.errorMessage || ""}`);
  check("it was attributed to the internal provider", analysis?.provider === "internal", analysis?.provider);

  check("a similarity score is produced", typeof analysis?.internalScore === "number" && analysis.internalScore > 0, `internalScore=${analysis?.internalScore}`);
  check("the headline score is not an external one", analysis?.externalScore === null, String(analysis?.externalScore));
  check("the word count of the submitted report is recorded", analysis?.totalWords > 50, String(analysis?.totalWords));

  const matches = await PlagiarismMatch.findAll({
    where: { analysisId: analysis.id },
    order: [["similarityPercentage", "DESC"]],
  });

  check("at least one match is reported", matches.length >= 1, `rows=${matches.length}`);

  const earlierMatch = matches.find((m) => m.sourceReportId === archived.report.id);
  check("the reused report is identified as the source", Boolean(earlierMatch), matches.map((m) => m.sourceReportId).join(","));
  check(
    "the match carries the academic year of the source, so reuse across cohorts is attributable",
    earlierMatch?.sourceAcademicYear === "2023/2024",
    String(earlierMatch?.sourceAcademicYear)
  );
  check("the match is an internal one", earlierMatch?.sourceType === "internal");
  check("a matched-word count is reported", (earlierMatch?.matchedWords || 0) > 20, String(earlierMatch?.matchedWords));
  check("an excerpt is captured for the reviewer", (earlierMatch?.matchedText || "").length > 20, (earlierMatch?.matchedText || "").slice(0, 60));

  const unrelatedMatch = matches.find((m) => m.sourceReportId === unrelatedReport.report.id);
  check(
    "the genuinely unrelated report is not reported as a match",
    !unrelatedMatch,
    unrelatedMatch ? `leaked sourceReportId=${unrelatedMatch.sourceReportId}` : "none"
  );

  // The engine must not score a document against itself.
  check(
    "the report is not matched against its own archived copy",
    !matches.some((m) => m.sourceReportId === submitted.report.id)
  );

  // --- the corpus is indexed for reuse -------------------------------------
  const archivedIndex = await ReportPlagiarismIndex.findOne({ where: { reportVersionId: archived.version.id } });
  check("the archived entry is fingerprinted for future comparisons", Array.isArray(archivedIndex?.corpusSignature) && archivedIndex.corpusSignature.length === 128, `len=${archivedIndex?.corpusSignature?.length}`);
  check("the exact shingle set is retained for confirmation", Array.isArray(archivedIndex?.corpusShingles) && archivedIndex.corpusShingles.length > 20, `n=${archivedIndex?.corpusShingles?.length}`);
  check("the algorithm version is recorded so a stale index is detectable", Boolean(archivedIndex?.algorithmVersion), archivedIndex?.algorithmVersion);

  // --- reading it back over the API ----------------------------------------
  const latest = await (await fetch(`${BASE}/plagiarism/reports/${submitted.report.id}/latest`, { headers: later.auth })).json();
  check("the result is readable over the API", latest.latest?.internalScore === analysis.internalScore, String(latest.latest?.internalScore));
  check("the internal matches are returned with their sources", (latest.latest?.matches || []).some((m) => m.sourceAcademicYear === "2023/2024"));

  // --- exclusion rules and the severity band -------------------------------
  check(
    "the reference list is identified as an excluded section",
    Array.isArray(analysis.excludedSections) && analysis.excludedSections.some((s) => /reference/i.test(s)),
    JSON.stringify(analysis.excludedSections)
  );
  check(
    "the amount of text excluded is recorded, so the effect is auditable",
    (analysis.rawSummary?.excludedCharacters || 0) > 50,
    String(analysis.rawSummary?.excludedCharacters)
  );
  check(
    "the score is classified into a severity band",
    ["low", "moderate", "high", "very_high"].includes(analysis.plagiarismStatus),
    String(analysis.plagiarismStatus)
  );
  check(
    "the band is consistent with the score at the configured 10/25/40 boundaries",
    (analysis.internalScore <= 10 && analysis.plagiarismStatus === "low") ||
      (analysis.internalScore > 10 && analysis.internalScore <= 25 && analysis.plagiarismStatus === "moderate") ||
      (analysis.internalScore > 25 && analysis.internalScore <= 40 && analysis.plagiarismStatus === "high") ||
      (analysis.internalScore > 40 && analysis.plagiarismStatus === "very_high"),
    `score=${analysis.internalScore} band=${analysis.plagiarismStatus}`
  );
  check(
    "66 %-class reuse lands in the top band rather than being understated",
    analysis.internalScore > 40 ? analysis.plagiarismStatus === "very_high" : true,
    `score=${analysis.internalScore} band=${analysis.plagiarismStatus}`
  );

  await submitted.entry.reload();
  check("the archived entry carries the band alongside the score", Boolean(submitted.entry.plagiarismStatus), String(submitted.entry.plagiarismStatus));

  // --- ReportAnalysis page contract ---------------------------------------
  // The page renders the band, the exclusions, the matched passages and the
  // history. Asserting these fields exist is what stops a blank panel: the
  // behaviour checks would all still pass if the payload quietly dropped one.
  const latestView = await (await fetch(`${BASE}/plagiarism/reports/${submitted.report.id}/latest`, { headers: later.auth })).json();

  const missingFields = [
    "overallScore",
    "provider",
    "completedAt",
    "excludedSections",
    "similarityBand.key",
    "similarityBand.label",
    "similarityBand.thresholds.low",
    "similarityBand.advice",
    "matches",
  ].filter((path) => {
    const value = path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), latestView.latest);
    return value === undefined || value === null;
  });
  check("the integrity view receives every field it renders", missingFields.length === 0, missingFields.join(", "));

  const firstMatch = (latestView.latest?.matches || [])[0];
  const matchMissing = ["id", "sourceType", "sourceTitle", "sourceAcademicYear", "matchedWords", "similarityPercentage", "matchedText"]
    .filter((key) => firstMatch?.[key] === undefined);
  check("a matched passage carries every field the card renders", matchMissing.length === 0, matchMissing.join(", "));
  check("the matched passage is long enough to read", (firstMatch?.matchedText || "").length > 20);

  check("the analysis history is returned for the history list", Array.isArray(latestView.history) && latestView.history.length >= 1, `n=${latestView.history?.length}`);
  check(
    "each history entry carries the status, provider and band the list renders",
    (latestView.history || []).every((h) => typeof h.status === "string" && "provider" in h && "similarityBand" in h),
    JSON.stringify(Object.keys(latestView.history?.[0] || {}))
  );

  console.log(`\n${failures === 0 ? "ALL INTERNAL-ENGINE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("INTERNAL ENGINE VERIFICATION ERROR:", error);
} finally {
  try {
    const reportIds = ids.reports.filter(Number.isInteger);
    if (reportIds.length) {
      const versions = await ReportVersion.findAll({ where: { reportId: reportIds }, attributes: ["id"] });
      const vIds = versions.map((v) => v.id);
      if (vIds.length) {
        await ReportPlagiarismIndex.destroy({ where: { reportVersionId: vIds } });
      }
      const analyses = await PlagiarismAnalysis.findAll({ where: { reportId: reportIds }, attributes: ["id"] });
      await PlagiarismMatch.destroy({ where: { analysisId: analyses.map((a) => a.id) } });
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
