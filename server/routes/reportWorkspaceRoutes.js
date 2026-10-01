import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { addReportComment, getReportWorkspace, saveReportWorkspace, deleteReportComment } from "../controllers/reportWorkspaceController.js";
import { exportReportAsWord } from "../controllers/wordExportController.js";
import { exportReportAsDocx, importReportFromWord } from "../controllers/wordController.js";
import {
  authenticatePdfFileRequest,
  getPdfFile,
  getPdfWorkspace,
  savePdfFile,
  patchPdfWorkspace,
  savePdfOverlay,
  exportModifiedPdf,
} from "../controllers/pdfWorkspaceController.js";
import { PDF_SAVE_LIMIT } from "../config/requestLimits.js";

const router = express.Router();
// admin is included because reportWorkspaceController.getAccess explicitly allows
// administrators (and returns readOnly for them). Omitting it here made that
// controller branch unreachable: an admin opening a report got 403 from this guard
// before the controller ever ran.
const workspaceRoles = authorize("student", "academic_supervisor", "professional_supervisor", "admin");

router.get("/reports/:id/workspace", protect, workspaceRoles, getReportWorkspace);

// --- PDF workshop -----------------------------------------------------------
router.get("/reports/:id/pdf", protect, workspaceRoles, getPdfWorkspace);
router.get("/reports/:id/pdf/file", authenticatePdfFileRequest, getPdfFile);
router.put(
  "/reports/:id/pdf/overlay",
  protect,
  authorize("student"),
  express.json({ limit: "10mb" }),
  savePdfOverlay
);
router.post(
  "/reports/:id/pdf/export",
  protect,
  workspaceRoles,
  express.json({ limit: "10mb" }),
  exportModifiedPdf
);
router.put(
  "/reports/:id/pdf/patch",
  protect,
  authorize("student"),
  express.json({ limit: "10mb" }),
  patchPdfWorkspace
);
// Raw PDF body: `express.raw` rather than `express.json`, and `application/pdf`
// is not JSON so the /api/workspace JSON parser above leaves the stream alone.
router.put(
  "/reports/:id/pdf/file",
  protect,
  authorize("student"),
  express.raw({ type: ["application/pdf", "application/octet-stream"], limit: PDF_SAVE_LIMIT }),
  savePdfFile
);

// Word download. Deliberately `protect` only: the controller re-applies the
// per-report access rules (including admin), so a route-level role list here would
// only duplicate - and previously contradicted - that check.
router.get("/reports/:id/word", protect, exportReportAsWord);

// Word round trip for the File tab. The import writes editor content into the
// report, so it is student-only, exactly like PUT .../workspace below; the export
// only reads, and re-applies the per-report access rules itself.
router.post("/import-word", protect, authorize("student"), upload.singleWord("document"), importReportFromWord);
router.post("/export-word", protect, workspaceRoles, exportReportAsDocx);

router.put("/reports/:id/workspace", protect, authorize("student"), saveReportWorkspace);
router.post("/reports/:id/comments", protect, authorize("academic_supervisor", "professional_supervisor"), addReportComment);
router.delete("/reports/:id/comments/:commentId", protect, authorize("academic_supervisor", "professional_supervisor"), deleteReportComment);

export default router;
