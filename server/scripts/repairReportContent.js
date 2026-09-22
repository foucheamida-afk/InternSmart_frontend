/**
 * Re-convert reports whose stored editor content is empty.
 *
 *   node scripts/repairReportContent.js [--report <id>] [--dry-run]
 *
 * A conversion that produced nothing used to be stored as if it were the finished
 * document (an empty paragraph is a valid-looking document), and opening the report
 * then wrote that empty document back over itself. The result was a report that
 * could never be recovered by opening it: every load saw "content is already
 * there". The workspace now re-reads the file in that situation, so this script is
 * for reports nobody has opened since, and for seeing what is affected.
 *
 * It only ever writes content that was converted from the report's own stored
 * file; a report whose file is missing or unreadable is reported and left alone.
 */
import dotenv from "dotenv";

dotenv.config();

import fs from "fs";
import path from "path";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import Report from "../models/reportModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import { extractDocumentContent, isContentlessDocument } from "../utils/documentExtraction.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIndex = args.indexOf("--report");
const onlyId = onlyIndex === -1 ? null : Number(args[onlyIndex + 1]);

const where = onlyId ? { id: onlyId } : {};
const reports = await Report.findAll({
  where,
  include: [{ model: Student, as: "student", include: [{ model: User, as: "user", attributes: ["email"] }] }],
  order: [["id", "ASC"]],
});

sequelize.options.logging = false;
console.log(`${dryRun ? "DRY RUN - " : ""}checking ${reports.length} report(s)${onlyId ? ` (report ${onlyId})` : ""}\n`);

let repaired = 0;
let skipped = 0;
let unreadable = 0;

for (const report of reports) {
  if (!isContentlessDocument(report.documentContent)) {
    skipped++;
    continue;
  }

  const owner = report.student?.user?.email || "unknown";
  const stored = report.documentContent === null ? "none" : `${JSON.stringify(report.documentContent).length} bytes`;

  if (!report.fileUrl) {
    console.log(`  #${report.id}  ${owner}  SKIP: no file reference  (${report.fileName})`);
    unreadable++;
    continue;
  }

  const absolutePath = path.join(process.cwd(), report.fileUrl.replace(/^[/\\]+/, ""));
  if (!fs.existsSync(absolutePath)) {
    console.log(`  #${report.id}  ${owner}  SKIP: file missing on disk  (${report.fileUrl})`);
    unreadable++;
    continue;
  }

  const converted = await extractDocumentContent(absolutePath);
  if (!converted || isContentlessDocument(converted)) {
    // A scanned PDF, or a Word file whose text really cannot be read. The
    // workspace tells the student this rather than showing a blank page.
    console.log(`  #${report.id}  ${owner}  UNREADABLE: conversion produced no content  (${report.fileName})`);
    unreadable++;
    continue;
  }

  const bytes = Buffer.byteLength(JSON.stringify(converted));
  if (dryRun) {
    console.log(`  #${report.id}  ${owner}  WOULD REPAIR: ${stored} -> ${bytes} bytes  (${report.fileName})`);
    repaired++;
    continue;
  }

  await report.update({ documentContent: converted });
  console.log(`  #${report.id}  ${owner}  REPAIRED: ${stored} -> ${bytes} bytes  (${report.fileName})`);
  repaired++;
}

console.log(`\n${dryRun ? "would repair" : "repaired"}: ${repaired}   already had content: ${skipped}   left alone: ${unreadable}`);
await sequelize.close();
