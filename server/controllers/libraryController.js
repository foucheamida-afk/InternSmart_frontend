import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import PlagiarismAnalysis from "../models/plagiarismAnalysisModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import { accessFor, shapeEntry, VISIBILITIES } from "../services/libraryService.js";

// Virtual library API (§4.12 phase 3).

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Resolve the caller's own Student row. Students are identified by Student.id in
// library rows, never by User.id, so the owner check needs this translation -
// and it must come from the database, not the request.
const ownStudentId = async (req) => {
  const roles = req.effectiveRoles || [req.user.role];
  if (!roles.includes("student")) return null;
  const student = await Student.findOne({ where: { userId: req.user.id }, attributes: ["id"] });
  return student?.id ?? null;
};

// Row-level scoping in SQL, so pagination counts only what the caller may see.
const visibilityScope = ({ role, effectiveRoles, userId, studentId }) => {
  const roles = effectiveRoles?.length ? effectiveRoles : [role];

  if (roles.includes("admin")) return {};

  if (roles.includes("academic_supervisor") || roles.includes("professional_supervisor")) {
    // Supervisors see the library; a private entry only if they supervised it.
    return {
      [Op.or]: [
        { visibility: { [Op.ne]: "private" } },
        { academicSupervisorId: userId },
        { professionalSupervisorId: userId },
      ],
    };
  }

  // A student sees tiered entries plus their own.
  const listed = [{ visibility: { [Op.in]: ["institution", "public"] } }];
  if (studentId !== null) listed.push({ studentId });

  return { [Op.or]: listed };
};

const entryInclude = [
  {
    model: Student,
    as: "student",
    attributes: ["id", "matricule", "class"],
    include: [{ model: User, as: "user", attributes: ["id", "name"] }],
  },
  { model: User, as: "academicSupervisor", attributes: ["id", "name"] },
  { model: User, as: "professionalSupervisor", attributes: ["id", "name"] },
];

// GET /api/library/reports
export const searchLibrary = async (req, res) => {
  try {
    const {
      q = "",
      academicYear = "",
      program = "",
      company = "",
      domain = "",
      visibility = "",
      page = 1,
      limit = PAGE_SIZE,
    } = req.query;

    const studentId = await ownStudentId(req);
    const scope = visibilityScope({
      role: req.user.role,
      effectiveRoles: req.effectiveRoles,
      userId: req.user.id,
      studentId,
    });

    const filters = {};

    const term = String(q).trim();
    if (term) {
      // Keyword matching is a LIKE over the serialised JSON array: MariaDB stores
      // JSON as LONGTEXT, so this is a substring match on the stored text rather
      // than a real JSON query. Adequate at this scale; a search index is the
      // right answer once the library is large (phase 4).
      filters[Op.or] = [
        { title: { [Op.like]: `%${term}%` } },
        { abstract: { [Op.like]: `%${term}%` } },
        { keywords: { [Op.like]: `%${term}%` } },
        { companyName: { [Op.like]: `%${term}%` } },
        { internshipDomain: { [Op.like]: `%${term}%` } },
      ];
    }

    if (academicYear) filters.academicYear = academicYear;
    if (program) filters.program = program;
    if (company) filters.companyName = { [Op.like]: `%${company}%` };
    if (domain) filters.internshipDomain = { [Op.like]: `%${domain}%` };

    // A student cannot narrow to a tier they cannot see anyway; admins may.
    if (visibility && VISIBILITIES.includes(visibility)) {
      const roles = req.effectiveRoles || [req.user.role];
      if (roles.includes("admin")) filters.visibility = visibility;
    }

    const where =
      Object.keys(filters).length > 0 ? { [Op.and]: [scope, filters] } : scope;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || PAGE_SIZE));

    const { count, rows } = await LibraryEntry.findAndCountAll({
      where,
      include: entryInclude,
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
      order: [["submissionDate", "DESC"]],
    });

    const roles = req.effectiveRoles || [req.user.role];
    const privileged = roles.includes("admin") ||
      roles.includes("academic_supervisor") ||
      roles.includes("professional_supervisor");

    return res.status(200).json({
      entries: rows.map((entry) => {
        const access = accessFor(entry, {
          userId: req.user.id,
          role: req.user.role,
          effectiveRoles: req.effectiveRoles,
          studentId,
        });
        return {
          ...shapeEntry(entry, access, { includeScores: privileged }),
          ownedByMe: studentId !== null && entry.studentId === studentId,
        };
      }),
      total: count,
      page: pageNumber,
      totalPages: Math.ceil(count / pageSize) || 1,
    });
  } catch (error) {
    console.error("SEARCH LIBRARY ERROR:", error);
    return res.status(500).json({
      message: "Server error while searching the library",
      error: error.message,
    });
  }
};

// GET /api/library/facets - the values available in the filter controls.
export const getLibraryFacets = async (req, res) => {
  try {
    const studentId = await ownStudentId(req);
    const scope = visibilityScope({
      role: req.user.role,
      effectiveRoles: req.effectiveRoles,
      userId: req.user.id,
      studentId,
    });

    const entries = await LibraryEntry.findAll({
      where: scope,
      attributes: ["academicYear", "program", "companyName", "internshipDomain"],
    });

    const distinct = (key) =>
      [...new Set(entries.map((entry) => entry[key]).filter(Boolean))].sort();

    return res.status(200).json({
      academicYears: distinct("academicYear"),
      programs: distinct("program"),
      companies: distinct("companyName"),
      domains: distinct("internshipDomain"),
    });
  } catch (error) {
    console.error("GET LIBRARY FACETS ERROR:", error);
    return res.status(500).json({
      message: "Server error while loading library filters",
      error: error.message,
    });
  }
};

const loadEntryWithAccess = async (req, id) => {
  const entry = await LibraryEntry.findByPk(id, { include: entryInclude });
  if (!entry) return { error: { status: 404, message: "Library entry not found" } };

  const studentId = await ownStudentId(req);
  const access = accessFor(entry, {
    userId: req.user.id,
    role: req.user.role,
    effectiveRoles: req.effectiveRoles,
    studentId,
  });

  // 404 rather than 403 when metadata is withheld: confirming that an entry
  // exists would itself disclose that a private report exists on that topic.
  if (!access.canViewMetadata) {
    return { error: { status: 404, message: "Library entry not found" } };
  }

  return { entry, access, studentId };
};

// GET /api/library/reports/:id
export const getLibraryEntry = async (req, res) => {
  try {
    const { entry, access, studentId, error } = await loadEntryWithAccess(req, req.params.id);
    if (error) return res.status(error.status).json({ message: error.message });

    const roles = req.effectiveRoles || [req.user.role];
    const privileged = roles.includes("admin") ||
      roles.includes("academic_supervisor") ||
      roles.includes("professional_supervisor");

    const shaped = shapeEntry(entry, access, { includeScores: privileged });

    return res.status(200).json({
      entry: {
        ...shaped,
        ownedByMe: studentId !== null && entry.studentId === studentId,
      },
    });
  } catch (error) {
    console.error("GET LIBRARY ENTRY ERROR:", error);
    return res.status(500).json({
      message: "Server error while loading the library entry",
      error: error.message,
    });
  }
};

// GET /api/library/reports/:id/preview
//
// Returns the file location only to a caller entitled to read the document. The
// location is never included in the metadata payload for a caller who may not
// open it, so this cannot be reached by guessing a path.
export const previewLibraryReport = async (req, res) => {
  try {
    const { entry, access, error } = await loadEntryWithAccess(req, req.params.id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (!access.canViewFullText) {
      return res.status(403).json({
        message:
          entry.visibility === "public"
            ? "You do not have access to this document."
            : "This report is archived for institutional records. Its metadata and abstract are available, but the full document can only be read by the student who wrote it, its supervisors, and administrators.",
        code: "FULL_TEXT_RESTRICTED",
      });
    }

    if (!entry.fileUrl) {
      return res.status(404).json({ message: "No file is stored for this entry." });
    }

    return res.status(200).json({
      fileName: entry.fileName,
      fileUrl: entry.fileUrl,
      fileHash: entry.fileHash,
    });
  } catch (error) {
    console.error("PREVIEW LIBRARY REPORT ERROR:", error);
    return res.status(500).json({
      message: "Server error while opening the library report",
      error: error.message,
    });
  }
};

// Normalise keywords from either a comma-separated string or an array.
//
// Deduplicated case-insensitively but stored with the author's casing, because
// they are displayed as written. Capped because an unbounded tag list is a
// denial-of-service vector against the search query.
const MAX_KEYWORDS = 15;
const MAX_KEYWORD_LENGTH = 40;
const MAX_ABSTRACT_LENGTH = 2000;

export const normalizeKeywords = (value) => {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");

  const seen = new Set();
  const keywords = [];

  for (const entry of raw) {
    const keyword = String(entry ?? "").trim().slice(0, MAX_KEYWORD_LENGTH);
    if (!keyword) continue;

    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    keywords.push(keyword);

    if (keywords.length >= MAX_KEYWORDS) break;
  }

  return keywords;
};

// PUT /api/library/reports/:id/details
//
// The abstract and keywords are what make the library searchable, and they are
// author-supplied metadata rather than anything derivable - so the owning student
// maintains them, and an administrator can correct them.
//
// Without this the keyword and abstract search matched nothing: every archived
// entry had both fields null, so a student could only ever discover a topic by
// its title.
export const updateLibraryDetails = async (req, res) => {
  try {
    const entry = await LibraryEntry.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ message: "Library entry not found" });

    const studentId = await ownStudentId(req);
    const roles = req.effectiveRoles || [req.user.role];
    const admin = roles.includes("admin");
    const owner = studentId !== null && entry.studentId === studentId;

    if (!admin && !owner) {
      return res.status(403).json({ message: "You cannot edit this entry." });
    }

    const updates = {};

    if (req.body?.abstract !== undefined) {
      updates.abstract = String(req.body.abstract ?? "").trim().slice(0, MAX_ABSTRACT_LENGTH) || null;
    }

    if (req.body?.keywords !== undefined) {
      updates.keywords = normalizeKeywords(req.body.keywords);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Provide an abstract or keywords to update." });
    }

    await entry.update(updates);

    return res.status(200).json({
      message: "Library entry updated.",
      entry: {
        id: entry.id,
        abstract: entry.abstract,
        keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
      },
    });
  } catch (error) {
    console.error("UPDATE LIBRARY DETAILS ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating the library entry",
      error: error.message,
    });
  }
};
export const updateLibraryVisibility = async (req, res) => {
  try {
    const { visibility } = req.body || {};

    if (!VISIBILITIES.includes(visibility)) {
      return res.status(400).json({
        message: `Visibility must be one of: ${VISIBILITIES.join(", ")}.`,
      });
    }

    const entry = await LibraryEntry.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ message: "Library entry not found" });

    const studentId = await ownStudentId(req);
    const roles = req.effectiveRoles || [req.user.role];
    const admin = roles.includes("admin");
    const owner = studentId !== null && entry.studentId === studentId;

    if (!admin && !owner) {
      return res.status(403).json({ message: "You cannot change this entry's visibility." });
    }

    if (!admin && visibility === "public") {
      return res.status(403).json({
        message: "Only an administrator can publish a report publicly. You may set it to private or institution.",
        code: "PUBLIC_REQUIRES_ADMIN",
      });
    }

    const updates = { visibility };

    // First time an entry leaves `private`, record when it became discoverable.
    if (!entry.publishedAt && visibility !== "private") {
      updates.publishedAt = new Date();
    }

    await entry.update(updates);

    return res.status(200).json({
      message: `Visibility set to ${visibility}.`,
      entry: { id: entry.id, visibility: entry.visibility, publishedAt: entry.publishedAt },
    });
  } catch (error) {
    console.error("UPDATE LIBRARY VISIBILITY ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating visibility",
      error: error.message,
    });
  }
};

// DELETE /api/library/reports/:id
export const deleteLibraryEntry = async (req, res) => {
  try {
    const entry = await LibraryEntry.findByPk(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: "Library entry not found" });
    }

    const roles = req.effectiveRoles || [req.user.role];
    if (!roles.includes("admin")) {
      return res.status(403).json({ message: "Only an administrator can remove a library entry." });
    }

    await sequelize.transaction(async (transaction) => {
      await PlagiarismAnalysis.update(
        { libraryEntryId: null },
        { where: { libraryEntryId: entry.id }, transaction }
      );
      await entry.destroy({ transaction });
    });

    return res.status(200).json({
      message: "Library entry removed successfully.",
      entryId: Number(req.params.id),
    });
  } catch (error) {
    console.error("DELETE LIBRARY ENTRY ERROR:", error);
    return res.status(500).json({
      message: "Server error while removing the library entry",
      error: error.message,
    });
  }
};
