/**
 * Endpoint check for the PDF workspace.
 *
 *   node scripts/verifyPdfWorkspace.js
 *
 * Runs the real router - auth, role guard, the raw-body PDF parser, the
 * controllers, the pdfjs structure reader and the PNG encoder - over HTTP
 * in-process. Only the database layer is faked, so this runs on a machine with
 * no MySQL: it proves the contract of
 *
 *   GET  /api/workspace/reports/:id/pdf        PDF file -> editable structure
 *   GET  /api/workspace/reports/:id/pdf/file   the file itself (as displayed)
 *   PUT  /api/workspace/reports/:id/pdf/file   edited PDF -> written over the file
 *
 * and, just as importantly, what it does NOT do: a PDF never becomes stored
 * editor content, so `Reports.documentContent` must stay untouched throughout.
 *
 * The PDF used as the fixture is produced by the real client renderer
 * (client/src/editor/pdfDocument.js) so the round trip being checked is the one
 * the application performs: document -> PDF -> document.
 */
import dotenv from "dotenv";

dotenv.config();

import fs from "fs";
import path from "path";
import express from "express";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import zlib from "zlib";

import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import ReportComment from "../models/reportCommentModel.js";
import reportWorkspaceRoutes from "../routes/reportWorkspaceRoutes.js";
import { WORKSPACE_JSON_LIMIT } from "../config/requestLimits.js";
import { encodeRgbaPng } from "../utils/pngEncoder.js";
import { readPdfStructure } from "../services/pdfStructureService.js";
import { renderDocumentToPdf } from "../../client/src/editor/pdfDocument.js";

const STUDENT_USER_ID = 42;
const STUDENT_ID = 7;
const SUPERVISOR_USER_ID = 99;
const OTHER_SUPERVISOR_USER_ID = 1234;
const REPORT_ID = 3;

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const FIXTURE_NAME = `_verify-pdf-${Date.now()}.pdf`;
const FIXTURE_URL = `/uploads/${FIXTURE_NAME}`;
const FIXTURE_PATH = path.join(UPLOAD_DIR, FIXTURE_NAME);
const SECOND_NAME = `_verify-pdf-rewritten-${Date.now()}.pdf`;
const SECOND_PATH = path.join(UPLOAD_DIR, SECOND_NAME);

const report = {
  id: REPORT_ID,
  studentId: STUDENT_ID,
  title: "Internship report",
  fileName: "internship-report.pdf",
  fileUrl: FIXTURE_URL,
  currentVersionId: 11,
  documentContent: null,
  lockedAt: null,
  status: "submitted",
  progress: 0,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  student: { internship: { academicSupervisorId: SUPERVISOR_USER_ID, professionalSupervisorId: null } },
  async update(values) {
    Object.assign(this, values);
    return this;
  },
};

const version = { id: 11, fileName: "internship-report.pdf", fileUrl: FIXTURE_URL, fileType: "application/pdf" };
const versionUpdates = [];

let currentUser = { id: STUDENT_USER_ID, active: true, role: "student", onboardingCompletedAt: new Date() };

// --- the only fakes in this file ------------------------------------------
User.findByPk = async () => currentUser;
Student.findOne = async () => ({ id: STUDENT_ID, userId: STUDENT_USER_ID });
Report.findByPk = async () => (report.__missing ? null : report);
ReportVersion.findByPk = async () => version;
ReportVersion.update = async (values, options) => {
  versionUpdates.push({ values, where: options?.where });
  return [1];
};
ReportComment.findAll = async () => [];
// --------------------------------------------------------------------------

const app = express();
app.use("/api/workspace", express.json({ limit: WORKSPACE_JSON_LIMIT }));
app.use(express.json());
app.use("/api/workspace", reportWorkspaceRoutes);
const request = supertest(app);

const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const asStudent = () => {
  currentUser = { id: STUDENT_USER_ID, active: true, role: "student", onboardingCompletedAt: new Date() };
  return tokenFor(currentUser);
};

const asSupervisor = (id = SUPERVISOR_USER_ID) => {
  currentUser = { id, active: true, role: "academic_supervisor", onboardingCompletedAt: new Date() };
  return tokenFor(currentUser);
};

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

const results = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const collectNodes = (node, type, found = []) => {
  if (!node || typeof node !== "object") return found;
  if (node.type === type) found.push(node);
  if (Array.isArray(node.content)) node.content.forEach((child) => collectNodes(child, type, found));
  return found;
};

const textOf = (node) => (node?.content || []).map((child) => child.text || "").join(" ").trim();

/** Every block of text on every page, in page order. */
const blocksOf = (structure) => collectNodes(structure, "pdfBlock");

const pagesOf = (structure) => (structure?.content || []).filter((node) => node?.type === "pdfPage");

// A figure so the round trip has to carry an image across, not just text. It is
// 120x60 pixels on purpose: the structure reader ignores images smaller than a
// bullet or an icon, and a 2x2 fixture would be filtered out by design.
const fixtureImage = (() => {
  const width = 120;
  const height = 60;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      rgba[offset] = Math.round((x / width) * 255);
      rgba[offset + 1] = Math.round((y / height) * 255);
      rgba[offset + 2] = 128;
      rgba[offset + 3] = 255;
    }
  }
  return encodeRgbaPng(width, height, rgba);
})();

const TINY_PNG = fixtureImage.toString("base64");

const sampleDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "GENERAL INTRODUCTION" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Software engineering is the application of " },
        { type: "text", marks: [{ type: "bold" }], text: "engineering principles" },
        { type: "text", text: " to software development." },
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1. CONTEXT" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Insertion phase." }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Technical phase." }] }] },
      ],
    },
    { type: "image", attrs: { src: `data:image/png;base64,${TINY_PNG}`, alt: "A figure", title: "Figure" } },
    { type: "pageBreak", attrs: { blank: false } },
    { type: "paragraph", content: [{ type: "text", text: "This page begins after a page break." }] },
  ],
};

const writeFixture = async (document, fileName) => {
  const blob = renderDocumentToPdf(document, { title: "Internship report", author: "FOUCHE HAMIDA" });
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.promises.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return buffer;
};

const run = async () => {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set - run this from the server directory with its .env present.");
    process.exitCode = 1;
    return;
  }

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

  // --- the PNG encoder, on its own -----------------------------------------
  {
    const png = encodeRgbaPng(2, 2, Uint8Array.from([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]));
    const signature = png.subarray(0, 8).toString("hex");
    check("png encoder writes a PNG signature", signature === "89504e470d0a1a0a", signature);

    // IDAT holds deflate-compressed scanlines; each is a filter byte plus RGBA.
    const idatStart = png.indexOf(Buffer.from("IDAT"));
    const raw = zlib.inflateSync(png.subarray(idatStart + 4, png.indexOf(Buffer.from("IEND")) - 4));
    const pixels = [...raw.subarray(1, 9)];
    check(
      "png encoder round-trips the pixels",
      raw.length === 2 * (2 * 4 + 1) && raw[0] === 0 && pixels.join(",") === "255,0,0,255,0,255,0,255",
      `raw=${raw.length} bytes`,
    );
  }

  const fixture = await writeFixture(sampleDocument, FIXTURE_NAME);
  check("fixture PDF was generated", fixture.subarray(0, 5).toString() === "%PDF-", `${fixture.length} bytes`);

  // 1. the structure of a PDF report, read out of the file.
  let response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf`)
    .set("Authorization", `Bearer ${asStudent()}`);

  const structure = response.body.structure || {};
  const pages = pagesOf(structure);
  const textBlocks = blocksOf(structure);
  const headings = textBlocks.filter((block) => Number(block.attrs?.heading) > 0).map(textOf);
  const paragraphs = textBlocks.map(textOf);
  const images = collectNodes(structure, "pdfFigure");

  check("GET pdf returns the extracted structure", response.status === 200 && structure.type === "doc", `status ${response.status}`);
  check("the structure keeps the document's headings", headings.some((text) => text.includes("GENERAL INTRODUCTION")), headings.join(" | ").slice(0, 90));
  check("structure keeps the paragraph text", paragraphs.some((text) => text.includes("Software engineering is the application of")), `${paragraphs.length} blocks`);
  check("structure keeps the figure", images.length >= 1, `${images.length} figure(s)`);
  check("the document is made of pages, not a re-flow", pages.length >= 2, `${pages.length} page node(s)`);
  check("bullet markers survive as text", paragraphs.some((text) => /Insertion phase/.test(text)), "list content kept in place");
  check("GET pdf reports the page count", response.body.pageCount >= 2, `pages=${response.body.pageCount}`);
  check(
    "GET pdf names the collaboration document",
    /^report-pdf-\d+-v\d+$/.test(response.body.collaborationDocument || ''),
    response.body.collaborationDocument,
  );
  check("GET pdf allows the author to write", response.body.canWrite === true && response.body.readOnly === false);
  check("GET pdf hands back the file location", response.body.fileUrl === FIXTURE_URL, response.body.fileUrl);

  // 1b. every block is positioned inside its own page, in points. This is what
  // makes the workspace show the PDF as it is rather than a re-flow of it.
  const geometry = textBlocks.map((block) => ({ attrs: block.attrs, page: pages.find((p) => (p.content || []).includes(block))?.attrs }));
  const missingGeometry = geometry.filter(({ attrs }) => !Number.isFinite(attrs?.x) || !Number.isFinite(attrs?.y)
    || !Number.isFinite(attrs?.width) || !Number.isFinite(attrs?.fontSize) || !Number.isFinite(attrs?.lineHeight));
  const outside = geometry.filter(({ attrs, page }) => page && (attrs.x < -2 || attrs.y < -2
    || attrs.x > page.width || attrs.y > page.height));

  check("every text block carries its position and type size", missingGeometry.length === 0, `${textBlocks.length} block(s) checked`);
  check("no block sits outside its page", outside.length === 0, outside.length ? JSON.stringify(outside[0].attrs).slice(0, 70) : "all inside");
  check(
    "pages keep their own size",
    pages.every((page) => Number(page.attrs?.width) > 100 && Number(page.attrs?.height) > 100),
    pages.map((page) => `${Math.round(page.attrs.width)}x${Math.round(page.attrs.height)}`).join(", "),
  );
  check(
    "the heading is distinguishable by size",
    (textBlocks.find((block) => textOf(block).includes("GENERAL INTRODUCTION"))?.attrs?.fontSize || 0)
      > (textBlocks.find((block) => textOf(block).includes("Software engineering"))?.attrs?.fontSize || 0),
    `${textBlocks.find((b) => textOf(b).includes("GENERAL INTRODUCTION"))?.attrs?.fontSize}pt vs ${textBlocks.find((b) => textOf(b).includes("Software engineering"))?.attrs?.fontSize}pt`,
  );
  check(
    "bold runs survive as marks",
    textBlocks.some((block) => (block.content || []).some((run) => (run.marks || []).some((mark) => mark.type === "bold"))),
    "the fixture's bold run is present",
  );

  // The rule the whole design rests on.
  check("reading a PDF writes nothing to the database", report.documentContent === null, `documentContent=${JSON.stringify(report.documentContent)}`);

  // 2. the file itself, which is what the workspace displays.
  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf/file?token=${encodeURIComponent(tokenFor(currentUser))}`)
    .buffer(true)
    .parse(binaryParser);
  check("the file is served as application/pdf", (response.headers["content-type"] || "").includes("application/pdf"), response.headers["content-type"]);
  check("the file is displayed inline, not downloaded", /^inline/.test(response.headers["content-disposition"] || ""), response.headers["content-disposition"]);
  check("the file response is not cached", /no-store/.test(response.headers["cache-control"] || ""), response.headers["cache-control"]);
  check("the file bytes are the stored PDF", Buffer.isBuffer(response.body) && response.body.subarray(0, 5).toString() === "%PDF-", `${Buffer.isBuffer(response.body) ? response.body.length : 0} bytes`);

  response = await request.get(`/api/workspace/reports/${REPORT_ID}/pdf/file`);
  check("the file needs a token", response.status === 401, `status ${response.status}`);

  response = await request.get(
    `/api/workspace/reports/${REPORT_ID}/pdf/file?token=${encodeURIComponent(asSupervisor(OTHER_SUPERVISOR_USER_ID))}`,
  );
  check("an unrelated user cannot read the file", response.status === 403, `status ${response.status}`);

  // 3. saving: the edited PDF replaces the file, and nothing else moves.
  const edited = await writeFixture(
    {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "REWRITTEN REPORT" }] },
        { type: "paragraph", content: [{ type: "text", text: "The paragraph was edited in the workspace." }] },
      ],
    },
    SECOND_NAME,
  );

  response = await request
    .put(`/api/workspace/reports/${REPORT_ID}/pdf/file`)
    .set("Authorization", `Bearer ${asStudent()}`)
    .set("Content-Type", "application/pdf")
    .send(edited);

  const onDisk = await fs.promises.readFile(FIXTURE_PATH);
  check("PUT writes the new PDF over the stored file", response.status === 200 && onDisk.equals(edited), `status ${response.status}, ${onDisk.length} bytes`);
  check("PUT reports the size it stored", response.body.bytes === edited.length, `${response.body.bytes}`);
  check("saving a PDF writes no editor content", report.documentContent === null);
  check(
    "saving keeps the archived version's hash and size in step",
    versionUpdates.length === 1
      && versionUpdates[0].where?.id === 11
      && typeof versionUpdates[0].values.fileHash === "string"
      && versionUpdates[0].values.fileSize === edited.length,
    JSON.stringify(versionUpdates[0]?.values || {}),
  );
  check("saving marks the report as updated", report.updatedAt > new Date("2026-01-01T00:00:00Z"), String(report.updatedAt));

  // 4. a non-PDF body must not be allowed near the file.
  const beforeGarbage = await fs.promises.readFile(FIXTURE_PATH);
  response = await request
    .put(`/api/workspace/reports/${REPORT_ID}/pdf/file`)
    .set("Authorization", `Bearer ${asStudent()}`)
    .set("Content-Type", "application/pdf")
    .send(Buffer.from("this is not a pdf, it is a sentence"));
  const afterGarbage = await fs.promises.readFile(FIXTURE_PATH);
  check("a body that is not a PDF is refused", response.status === 422 && response.body.code === "NOT_A_PDF", `status ${response.status}`);
  check("a refused save leaves the file untouched", beforeGarbage.equals(afterGarbage));

  // 5. permissions and the finalised-report rule.
  response = await request
    .put(`/api/workspace/reports/${REPORT_ID}/pdf/file`)
    .set("Authorization", `Bearer ${asSupervisor()}`)
    .set("Content-Type", "application/pdf")
    .send(edited);
  check("a supervisor cannot overwrite the PDF", response.status === 403, `status ${response.status}`);

  report.lockedAt = new Date();
  response = await request
    .put(`/api/workspace/reports/${REPORT_ID}/pdf/file`)
    .set("Authorization", `Bearer ${asStudent()}`)
    .set("Content-Type", "application/pdf")
    .send(edited);
  check("a finalised report cannot be rewritten", response.status === 409 && response.body.code === "REPORT_LOCKED", `status ${response.status}`);

  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf`)
    .set("Authorization", `Bearer ${asStudent()}`);
  check("a finalised report is read-only in the response", response.body.canWrite === false && response.body.readOnly === true);
  report.lockedAt = null;

  // 6. the structure follows the file: after a save the workspace must describe
  // what is now on disk, not what was there before. The cache is keyed by size
  // and mtime, so this also proves a changed file is not served from the cache.
  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf`)
    .set("Authorization", `Bearer ${asStudent()}`);
  const rewrittenHeadings = blocksOf(response.body.structure || {}).map(textOf);
  check(
    "the structure is re-read after the file changes",
    rewrittenHeadings.some((text) => text.includes("REWRITTEN REPORT")),
    rewrittenHeadings.join(" | ").slice(0, 90),
  );

  // 7. a Word report is not a PDF report.
  version.fileName = "internship-report.docx";
  version.fileUrl = "/uploads/internship-report.docx";
  report.fileName = "internship-report.docx";
  report.fileUrl = "/uploads/internship-report.docx";
  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf`)
    .set("Authorization", `Bearer ${asStudent()}`);
  check("a Word report is redirected to the writing workspace", response.status === 409 && response.body.code === "REPORT_NOT_PDF", `status ${response.status}`);

  // 7b. Opening a PDF through the *Word* workspace must not convert it either.
  // That route used to lazily extract the PDF's text and store it in
  // `documentContent`, which is the second copy of the document this design
  // exists to prevent - and it ran before the client had a chance to redirect.
  version.fileName = "internship-report.pdf";
  version.fileUrl = FIXTURE_URL;
  report.fileName = "internship-report.pdf";
  report.fileUrl = FIXTURE_URL;
  report.documentContent = null;
  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/workspace`)
    .set("Authorization", `Bearer ${asStudent()}`);
  check(
    "the Word workspace hands a PDF over instead of converting it",
    response.status === 200 && response.body.pdfWorkspace === true && response.body.editable === false,
    `status ${response.status} pdfWorkspace=${response.body.pdfWorkspace}`,
  );
  check(
    "opening a PDF through the Word workspace stores no content",
    report.documentContent === null,
    `documentContent=${JSON.stringify(report.documentContent)?.slice(0, 40)}`,
  );

  // 8. a missing file is explained rather than crashing.
  version.fileName = "gone.pdf";
  report.fileName = "gone.pdf";
  version.fileUrl = "/uploads/does-not-exist.pdf";
  report.fileUrl = "/uploads/does-not-exist.pdf";
  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf`)
    .set("Authorization", `Bearer ${asStudent()}`);
  check("a missing file is reported", response.status === 404 && response.body.code === "REPORT_FILE_MISSING", `status ${response.status}`);

  // 9. a report the caller has nothing to do with.
  report.__missing = true;
  response = await request
    .get(`/api/workspace/reports/${REPORT_ID}/pdf`)
    .set("Authorization", `Bearer ${asStudent()}`);
  check("an unknown report is a 404", response.status === 404, `status ${response.status}`);
  report.__missing = false;

  // 10. authentication on the structure route.
  response = await request.get(`/api/workspace/reports/${REPORT_ID}/pdf`);
  check("GET pdf requires a token", response.status === 401, `status ${response.status}`);

  // 11. Layout fidelity: the document that comes out of the file is drawn back
  // out and read again, and the text must land where it was. Without this the
  // workspace could look right once and drift a little on every save.
  {
    const source = await readPdfStructure(FIXTURE_PATH);
    const rendered = Buffer.from(await (await renderDocumentToPdf(source.document, { title: "Round trip" })).arrayBuffer());
    const roundTripPath = path.join(UPLOAD_DIR, `_verify-roundtrip-${Date.now()}.pdf`);
    await fs.promises.writeFile(roundTripPath, rendered);

    try {
      const again = await readPdfStructure(roundTripPath);
      const sourcePages = pagesOf(source.document);
      const againPages = pagesOf(again.document);

      check("the round trip keeps the page count", againPages.length === sourcePages.length, `${sourcePages.length} -> ${againPages.length}`);
      check(
        "the round trip keeps every page size",
        sourcePages.every((page, index) => againPages[index]
          && Math.abs(page.attrs.width - againPages[index].attrs.width) < 0.6
          && Math.abs(page.attrs.height - againPages[index].attrs.height) < 0.6),
        sourcePages.map((page) => `${Math.round(page.attrs.width)}x${Math.round(page.attrs.height)}`).join(", "),
      );

      const sourceText = blocksOf(source.document).map(textOf).join(" ").replace(/\s+/g, " ").trim();
      const againText = blocksOf(again.document).map(textOf).join(" ").replace(/\s+/g, " ").trim();
      check(
        "the round trip keeps the text",
        againText.length >= sourceText.length * 0.98,
        `${sourceText.length} -> ${againText.length} characters`,
      );

      // Every block is matched to its nearest counterpart: an extra split or merge
      // changes the count without moving the text.
      let compared = 0;
      let nearby = 0;
      let worst = 0;
      sourcePages.forEach((page, index) => {
        const target = againPages[index];
        if (!target) return;
        const candidates = (target.content || []).filter((node) => node.type === "pdfBlock");
        for (const block of (page.content || []).filter((node) => node.type === "pdfBlock")) {
          let best = Infinity;
          for (const candidate of candidates) {
            const distance = Math.max(
              Math.abs(block.attrs.x - candidate.attrs.x),
              Math.abs(block.attrs.y - candidate.attrs.y),
            );
            if (distance < best) best = distance;
          }
          if (!Number.isFinite(best)) continue;
          compared += 1;
          if (best <= 3) nearby += 1;
          worst = Math.max(worst, best);
        }
      });

      check(
        "text lands back where it was (within 3pt)",
        compared > 0 && nearby / compared >= 0.95,
        `${nearby}/${compared} blocks, worst ${worst.toFixed(1)}pt`,
      );    } finally {
      await fs.promises.rm(roundTripPath, { force: true });
    }
  }

  const failed = results.filter((entry) => !entry.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
};

run()
  .catch((error) => {
    console.error("VERIFY FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await fs.promises.rm(FIXTURE_PATH, { force: true });
    await fs.promises.rm(SECOND_PATH, { force: true });
  });
