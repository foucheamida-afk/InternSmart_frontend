// Pre-flight parse check for every script in this directory.
//
// The verification scripts are long, single-scope modules, and a duplicate
// top-level `const` is a *load* error - Node refuses to run the file at all. The
// symptom is a truncated stack trace and zero checks reported, which reads like a
// test failure rather than a typo, and it has cost several cycles.
//
// `node --check` is not part of running a script, so the mistake only appears
// when the suite is invoked. This runs the parse check across every script in one
// pass and fails loudly before anything else executes.
//
// Usage: node scripts/checkScripts.js
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

const scripts = fs
  .readdirSync(here)
  .filter((name) => name.endsWith(".js") && name !== path.basename(fileURLToPath(import.meta.url)))
  .sort();

const failures = [];

for (const name of scripts) {
  try {
    execFileSync(process.execPath, ["--check", path.join(here, name)], { stdio: "pipe" });
  } catch (error) {
    // Surface only the useful line: Node buries the cause under loader frames.
    const output = `${error.stderr || ""}${error.stdout || ""}`;
    const syntaxLine = output.split("\n").find((line) => line.includes("SyntaxError"));
    failures.push({ name, message: syntaxLine?.trim() || "parse error" });
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} script(s) failed to parse:\n`);
  for (const failure of failures) {
    console.error(`  ${failure.name}: ${failure.message}`);
  }
  console.error("\nFix these before running the suites - a parse error reports as zero checks.\n");
  process.exit(1);
}

console.log(`All ${scripts.length} scripts parse cleanly.`);
