import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  searchLibrary,
  getLibraryFacets,
  getLibraryEntry,
  previewLibraryReport,
  updateLibraryVisibility,
  updateLibraryDetails,
  deleteLibraryEntry,
} from "../controllers/libraryController.js";

const router = express.Router();

// Every authenticated role may browse the library, but each sees a different
// slice of it: the controller scopes the rows in SQL and filters the fields per
// entry, so a student cannot receive a document they are not entitled to read.
// Administrators are included because they curate visibility.
const anyRole = authorize(
  "student",
  "academic_supervisor",
  "professional_supervisor",
  "admin"
);

// Registered before "/:id" so "facets" is not read as an entry id.
router.get("/facets", protect, anyRole, getLibraryFacets);
router.get("/reports", protect, anyRole, searchLibrary);
router.get("/reports/:id", protect, anyRole, getLibraryEntry);
router.get("/reports/:id/preview", protect, anyRole, previewLibraryReport);
router.put("/reports/:id/visibility", protect, anyRole, updateLibraryVisibility);
router.delete("/reports/:id", protect, anyRole, deleteLibraryEntry);

// Author-supplied metadata. This is what makes keyword and abstract search
// return anything: without it every archived entry has both fields null.
router.put("/reports/:id/details", protect, anyRole, updateLibraryDetails);

export default router;
