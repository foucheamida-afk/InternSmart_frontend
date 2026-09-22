// Run every verification suite and refuse to report success on an empty run.
//
// Why this exists: invoking a suite by a path that does not exist produces no
// PASS/FAIL lines at all, and a naive harness that only counts failures reports
// "0 fails" - a green result for a suite that never ran. That happened for real
// during this session: a command lost its working directory and all seven suites
// reported `checks=0 fails=0`, which reads exactly like success.
//
// So this runner treats a suite that produced *no* checks as a failure, and it
// fails loudly if a suite cannot be launched at all.
//
// Usage:
//   node scripts/runSuites.js                 # uses the default mode per suite
//   node scripts/runSuites.js configured      # sets the mode for verifyPlagiarism
//
// Note: verifyPlagiarism.js needs the API started WITH a matching
// PLAGIARISM_WEBHOOK_SECRET to run in `configured` mode, and WITHOUT one for
// `unconfigured`. The default below matches a server started from a bare .env.
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const plagiarismMode = process.argv[2] || "unconfigured";

const SUITES = [
  { file: "verifySupervisorFlow.js", args: [], needsServer: false },
  { file: "verifyOnboardingGate.js", args: [], needsServer: true },
  { file: "verifyReportWorkflow.js", args: [], needsServer: true },
  { file: "verifyUiContract.js", args: [], needsServer: true },
  { file: "verifyLibrary.js", args: [], needsServer: true },
  { file: "verifyPlagiarism.js", args: [plagiarismMode], needsServer: true },
  { file: "verifyInternalEngine.js", args: [], needsServer: true },
  { file: "verifyUploadSecurity.js", args: [], needsServer: true },
  { file: "verifyErrorEnvelope.js", args: [], needsServer: true },
  { file: "verifyDashboardStats.js", args: [], needsServer: true },
];

const run = (file, args) => {
  try {
    const stdout = execFileSync(process.execPath, [path.join(here, file), ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    // A non-zero exit from a suite is expected when checks fail; the output still
    // carries the results, so it is returned rather than discarded.
    return { ok: false, output: `${error.stdout || ""}${error.stderr || ""}` };
  }
};

const results = [];
let totalChecks = 0;
let totalFails = 0;
let broken_count = 0;

for (const suite of SUITES) {
  const { ok, output } = run(suite.file, suite.args);
  const lines = output.split("\n").filter((line) => /^(PASS|FAIL)  /.test(line));
  const fails = lines.filter((line) => line.startsWith("FAIL")).length;

  totalChecks += lines.length;
  totalFails += fails;

  // Every suite ends with its own verdict line ("ALL ... CHECKS PASSED" or
  // "N CHECK(S) FAILED"). If that line is absent the suite threw partway
  // through, and a partial run reports whatever checks it reached with zero
  // failures - which reads as a pass. That happened for real: a suite dropped
  // from 59 checks to 26 on an undefined variable and the harness called it ok.
  const reachedVerdict = /CHECKS PASSED|CHECKS? FAILED|CHECK\(S\) FAILED/.test(output);

  const broken = lines.length === 0 || !reachedVerdict;

  if (broken) broken_count += 1;

  results.push({ ...suite, checks: lines.length, fails, broken, exited: ok });
}

console.log("");
for (const result of results) {
  const label = `${result.file}${result.args.length ? ` (${result.args.join(" ")})` : ""}`;
  const status = result.broken
    ? "DID NOT COMPLETE - see the error"
    : result.fails > 0
      ? `${result.fails} FAILED`
      : "ok";
  console.log(`  ${label.padEnd(46)} checks=${String(result.checks).padEnd(4)} ${status}`);
}

console.log(`\n  TOTAL checks=${totalChecks} fails=${totalFails} suites=${results.length}`);

if (broken_count > 0) {
  console.error(
    `\n  ${broken_count} suite(s) did not run to completion. That is not a pass: the file may be missing, the\n` +
      `  process may have failed to start, or it threw partway through and reported only the checks it reached.\n` +
      `  Run the suite directly to see the error.\n`
  );
  process.exit(1);
}

if (totalFails > 0) {
  console.error(`\n  ${totalFails} check(s) failed.\n`);
  process.exit(1);
}

console.log("\n  All suites passed.\n");
