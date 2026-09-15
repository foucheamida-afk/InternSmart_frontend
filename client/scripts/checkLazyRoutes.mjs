// Guard for route-level code splitting (NFR-PERF-04).
//
// `React.lazy(() => import('./pages/Thing'))` fails at *runtime*, not at build
// time, if the path is wrong or the module has no default export. The bundler is
// happy - it either cannot resolve the import (a warning at most) or resolves it
// to a module whose default is undefined - and the user gets a blank screen with
// nothing in the console that names the route. That is a bad failure to discover
// in production, so it is checked statically here.
//
// Usage:  node scripts/checkLazyRoutes.mjs   (from the client directory)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../src");
const appFile = path.join(srcRoot, "App.jsx");

if (!fs.existsSync(appFile)) {
  console.error(`Cannot find ${appFile}`);
  process.exit(1);
}

const source = fs.readFileSync(appFile, "utf8");
const targets = [...source.matchAll(/lazy\(\(\)\s*=>\s*import\('([^']+)'\)\)/g)].map((m) => m[1]);

if (targets.length === 0) {
  console.error("No lazy() imports found in App.jsx - has code splitting been removed?");
  process.exit(1);
}

const resolve = (specifier) => {
  const base = path.resolve(srcRoot, specifier);
  const candidates = [base, `${base}.jsx`, `${base}.js`, path.join(base, "index.jsx")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
};

const problems = [];

for (const specifier of targets) {
  const file = resolve(specifier);
  if (!file) {
    problems.push(`${specifier}: file not found`);
    continue;
  }

  const contents = fs.readFileSync(file, "utf8");
  if (!/export\s+default\s/.test(contents)) {
    problems.push(`${specifier}: no default export, so React.lazy would render nothing`);
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} lazy route(s) would fail at runtime:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(`All ${targets.length} lazy routes resolve to a module with a default export.`);
