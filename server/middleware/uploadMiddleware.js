import multer from "multer";
import { isDocxFile, isLegacyDocFile, isPdfFile } from "../utils/documentTypes.js";
import { validateDocumentContent } from "../utils/fileContent.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, per NFR-SEC-04

// Files are buffered in memory: the AI endpoints parse the PDF straight from the
// buffer and never need it written to disk, and the Word import converts the
// buffer in place.
//
// Memory storage is also what makes content validation possible here at all: the
// declared MIME type and the file name are both client-controlled, so the bytes
// are the only thing worth checking, and a disk-storage filter never sees them.
const createMemoryUpload = (accepts, label, kind, explainRejection) => multer({
  storage: multer.memoryStorage(),

  limits: {
    // This was 20 MB, which exceeded the 10 MB cap required by NFR-SEC-04 - and
    // since it is the uploader for /api/ai/*, a single request could buffer 20 MB
    // of RAM. Now aligned with the documented limit.
    fileSize: MAX_FILE_SIZE_BYTES,
  },

  fileFilter: (_req, file, cb) => {
    // Exact MIME allow-list (not an extension check) - see utils/documentTypes.js
    // for the one exception, a .docx sent with a generic zip/octet-stream type.
    if (accepts(file)) return cb(null, true);

    const explained = explainRejection?.(file);
    if (explained) {
      const error = new Error(explained);
      error.code = "UNSUPPORTED_FILE_FORMAT";
      return cb(error);
    }
    return cb(new Error(`Only ${label} files are allowed.`));
  },
});

// Content check, run after multer has the bytes.
//
// The MIME filter above stops an honest client picking the wrong file; this stops
// a dishonest one claiming the right one. A file renamed to .pdf, or a polyglot
// carrying a script preamble ahead of a PDF body, passes the filter and fails
// here.
const contentGuard = (kind) => (req, res, next) => {
  const file = req.file;
  if (!file?.buffer) return next();

  const verdict = validateDocumentContent(file.buffer, kind);
  if (verdict.ok) return next();

  return res.status(415).json({ message: verdict.reason });
};

// The AI endpoints only read PDFs today, so this stays PDF-only rather than
// accepting a Word file they would then fail to parse.
const pdfUpload = createMemoryUpload(isPdfFile, "PDF", "pdf");

// The writing-workspace Word import. Legacy .doc is rejected with an actionable
// message: "Only Word (.docx) files are allowed" leaves the user staring at an
// obviously-Word file wondering why it was refused.
const wordUpload = createMemoryUpload(
  isDocxFile,
  "Word (.docx)",
  "docx",
  (file) => (isLegacyDocFile(file)
    ? "Legacy .doc files are not supported. Open the file in Word, save it as .docx, then import it again."
    : null),
);

// Multer reports limit violations as a MulterError, which Express surfaces as an
// opaque 500. Translating them means the cap is actually communicated.
// Exported as an object with `single`/`singleWord` so existing
// `upload.single(...)` call sites keep working unchanged.
const wrap = (instance, field, kind) => (req, res, next) =>
  instance.single(field)(req, res, (error) => {
    if (!error) return contentGuard(kind)(req, res, next);

    if (error.code === "UNSUPPORTED_FILE_FORMAT") {
      return res.status(415).json({ message: error.message });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: `File is too large. The maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
        });
      }
      return res.status(400).json({ message: error.message });
    }

    return res.status(400).json({ message: error.message || "Invalid file upload." });
  });

export { MAX_FILE_SIZE_BYTES };
export default {
  single: (field) => wrap(pdfUpload, field, "pdf"),
  singleWord: (field) => wrap(wordUpload, field, "docx"),
};
