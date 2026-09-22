import LibraryEntry from "../models/libraryEntryModel.js";
import Internship from "../models/studentAssignmentModel.js";
import { academicYearFor } from "../utils/academicYear.js";
import { bandSummary } from "../utils/similarityThresholds.js";

// The virtual library (§4.12 phase 3).
//
// Access is the substantive part of this module, not the search. The stated goal
// is to stop students reusing reports from earlier cohorts, and the archive
// serves that goal only if a student can discover that a topic was already
// covered *without* being handed the text to copy. Hence three tiers:
//
//   private      the owning student, their supervisors, administrators
//   institution  additionally: any student may see the metadata and abstract
//   public       additionally: any student may read the full document
//
// A student therefore gets metadata and an abstract by default, and the full
// document only when the entry has been deliberately published. Supervisors and
// administrators see the library in full.

export const VISIBILITIES = ["private", "institution", "public"];

const isAdmin = (role, effectiveRoles) =>
  role === "admin" || effectiveRoles.includes("admin");

const isSupervisor = (role, effectiveRoles) =>
  role === "academic_supervisor" ||
  role === "professional_supervisor" ||
  effectiveRoles.includes("academic_supervisor") ||
  effectiveRoles.includes("professional_supervisor");

// Decide what this caller may do with this entry.
//
// `studentId` is the caller's own Student row id when they are a student - it is
// the owner check, and it must come from the database rather than from the
// request body.
export const accessFor = (entry, { userId, role, effectiveRoles = [], studentId = null }) => {
  const owner = studentId !== null && entry.studentId === studentId;
  const assignedSupervisor =
    Boolean(userId) &&
    (entry.academicSupervisorId === userId || entry.professionalSupervisorId === userId);

  if (isAdmin(role, effectiveRoles)) {
    return { canViewMetadata: true, canViewFullText: true, canList: true, basis: "administrator" };
  }

  if (owner) {
    return { canViewMetadata: true, canViewFullText: true, canList: true, basis: "owner" };
  }

  if (isSupervisor(role, effectiveRoles)) {
    // Supervisors work with the library; only a private entry they did not
    // supervise is withheld.
    const allowed = entry.visibility !== "private" || assignedSupervisor;
    return {
      canViewMetadata: allowed,
      canViewFullText: allowed,
      canList: allowed,
      basis: assignedSupervisor ? "assigned supervisor" : "supervisor",
    };
  }

  // A student who is not the owner.
  const listed = entry.visibility === "institution" || entry.visibility === "public";
  return {
    canViewMetadata: listed,
    canViewFullText: entry.visibility === "public",
    canList: listed,
    basis: "student",
  };
};

// Shape an entry for a caller, omitting both the fields they may not see and the
// file location when they may not read the document.
//
// Filtering here rather than in the client means a payload cannot leak a file URL
// that the client simply chooses not to render.
export const shapeEntry = (entry, access, { includeScores = false } = {}) => {
  const plain = typeof entry.toJSON === "function" ? entry.toJSON() : entry;

  const shape = {
    id: plain.id,
    reportId: plain.reportId,
    title: plain.title,
    abstract: plain.abstract,
    keywords: Array.isArray(plain.keywords) ? plain.keywords : [],
    academicYear: plain.academicYear,
    program: plain.program,
    classLevel: plain.classLevel,
    companyName: plain.companyName,
    internshipDomain: plain.internshipDomain,
    submissionDate: plain.submissionDate,
    visibility: plain.visibility,
    canViewFullText: access.canViewFullText,
    accessBasis: access.basis,
    student: plain.student
      ? {
          id: plain.student.id,
          name: plain.student.user?.name ?? null,
          matricule: plain.student.matricule,
          class: plain.student.class,
        }
      : null,
    supervisors: {
      academic: plain.academicSupervisor?.name ?? null,
      professional: plain.professionalSupervisor?.name ?? null,
    },
  };

  // The document location is only sent to a caller allowed to open it.
  if (access.canViewFullText) {
    shape.fileName = plain.fileName;
    shape.fileUrl = plain.fileUrl;
    shape.fileHash = plain.fileHash;
  }

  // Plagiarism scores are withheld from students until institutional policy on
  // visibility is decided; supervisors and administrators always see them.
  if (includeScores) {
    shape.finalPlagiarismScore = plain.finalPlagiarismScore;
    shape.internalSimilarityScore = plain.internalSimilarityScore;
    shape.externalSimilarityScore = plain.externalSimilarityScore;
    shape.plagiarismStatus = plain.plagiarismStatus;

    // The band is sent with the boundaries that produced it, so the number and
    // its label cannot disagree on screen if the thresholds are retuned later.
    shape.similarityBand = plain.finalPlagiarismScore === null || plain.finalPlagiarismScore === undefined
      ? null
      : bandSummary(plain.finalPlagiarismScore);
  }

  return shape;
};

// Archive a report version into the library.
//
// Called when a report reaches final submission. Uses the version id as the
// idempotency key, so a retried submission archives once.
export const archiveFinalReport = async ({ report, version, student, submission = null }) => {
  const internship = await Internship.findOne({ where: { studentId: report.studentId } });
  const submissionDate = submission?.submittedAt || new Date();

  const [entry, created] = await LibraryEntry.findOrCreate({
    where: { reportVersionId: version.id },
    defaults: {
      reportId: report.id,
      reportVersionId: version.id,
      studentId: report.studentId,
      title: report.title,

      // Snapshot the descriptors: renaming a company or a class later must not
      // rewrite what the archive says was submitted.
      academicYear: internship?.academicYear || academicYearFor(submissionDate),
      program: internship?.program || null,
      classLevel: student?.class || null,
      companyName: internship?.company || null,
      internshipDomain: internship?.internshipDomain || null,

      academicSupervisorId: internship?.academicSupervisorId || null,
      professionalSupervisorId: internship?.professionalSupervisorId || null,

      fileName: version.fileName,
      fileUrl: version.fileUrl,
      fileHash: version.fileHash,

      submissionDate,
      visibility: "institution",
      publishedAt: submissionDate,
    },
  });

  return { entry, created };
};

export default { accessFor, shapeEntry, archiveFinalReport, VISIBILITIES };
