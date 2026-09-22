/**
 * The file types InternSmart accepts for report documents, in one place.
 *
 * Three separate places used to hard-code "application/pdf" (the shared upload
 * middleware, the student report upload route and the PDF text extractor).
 * Adding Word support to one of them but not the others is how you end up with
 * a route that accepts a file no downstream step can read, so the MIME types and
 * the matching rules live here and everybody imports them.
 */

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const PDF_EXTENSION = ".pdf";
export const DOCX_EXTENSION = ".docx";

export const REPORT_UPLOAD_LABEL = "PDF or Word (.docx)";

const extensionOf = (fileName = "") => {
  const match = String(fileName).toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
};

export const isPdfFile = (file = {}) =>
  file.mimetype === PDF_MIME && extensionOf(file.originalname) === PDF_EXTENSION;

/**
 * Browsers occasionally send the generic zip/octet-stream type for a .docx, so
 * the extension is allowed to stand in for the MIME type - but only for those
 * two container types, and the file still has to survive being parsed as OOXML
 * before anything is stored or converted.
 */
export const isDocxFile = (file = {}) => {
  const extension = extensionOf(file.originalname);
  if (extension !== DOCX_EXTENSION) return false;
  return file.mimetype === DOCX_MIME
    || file.mimetype === "application/octet-stream"
    || file.mimetype === "application/zip"
    || file.mimetype === "application/x-zip-compressed";
};

export const isReportDocument = (file = {}) => isPdfFile(file) || isDocxFile(file);

/** Word 97-2003 (.doc) is a completely different format that cannot be read. */
export const isLegacyDocFile = (file = {}) => extensionOf(file.originalname) === ".doc";

export const isDocxPath = (filePath = "") => extensionOf(filePath) === DOCX_EXTENSION;

/**
 * Both report formats are accepted on upload, but they are not equally usable:
 * a .docx is converted into editable editor content and can be worked on in the
 * writing workspace, while a .pdf is only ever read. That difference is a rule,
 * not a display detail, so it is decided here and every consumer (the upload
 * response, My Reports, the workspace load/save and the Word import) asks this
 * rather than each re-deriving "is this a Word file?" from a file name.
 */
export const REPORT_FILE_KIND = {
  DOCX: "docx",
  PDF: "pdf",
};

/**
 * Classify a stored report file. The MIME type recorded on the version row is
 * authoritative when present; the file name is the fallback because reports
 * uploaded before that column was populated only have a name to go on.
 */
export const reportFileKind = ({ fileType, fileName, filePath } = {}) => {
  const name = String(filePath || fileName || "");
  const extension = extensionOf(name);
  if (extension === DOCX_EXTENSION) return REPORT_FILE_KIND.DOCX;
  if (extension === PDF_EXTENSION) return REPORT_FILE_KIND.PDF;

  const mime = String(fileType || "").toLowerCase();
  if (mime === DOCX_MIME) return REPORT_FILE_KIND.DOCX;
  if (mime === PDF_MIME) return REPORT_FILE_KIND.PDF;

  return null;
};

/** Only a Word (.docx) report may be edited in the writing workspace. */
export const isEditableReportFile = (file = {}) => reportFileKind(file) === REPORT_FILE_KIND.DOCX;
