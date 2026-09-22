// Content validation for uploaded files.
//
// Until now every upload check looked only at the *declared* MIME type and the
// file name - both of which the client controls. A file called `report.pdf` with
// `Content-Type: application/pdf` was accepted whatever its bytes actually were,
// and a CSV was accepted on the strength of its name alone. NFR-SEC-04 asks for
// "header stripping", and the substance of that is: the document's own signature
// must come first, and it must be the only thing there.
//
// This inspects the bytes rather than trusting the declaration. It is a
// validation gate, not a sanitiser - it rejects rather than repairs, because
// rewriting a file to make it safe is how a parser is handed something it did
// not expect.

// A real PDF begins with this at offset 0. Requiring offset 0 is the point: a
// file that carries a script preamble and *then* a PDF body is a polyglot, and
// finding the signature anywhere in the buffer would accept it.
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

// Every OOXML document is a ZIP container.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// Leading bytes of executables and scripts. A document upload has no legitimate
// reason to start with any of these.
const EXECUTABLE_SIGNATURES = [
  { name: "shebang script", bytes: Buffer.from("#!", "ascii") },
  { name: "Windows executable", bytes: Buffer.from("MZ", "ascii") },
  { name: "ELF binary", bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]) },
  { name: "Java class", bytes: Buffer.from([0xca, 0xfe, 0xba, 0xbe]) },
  { name: "Mach-O binary", bytes: Buffer.from([0xfe, 0xed, 0xfa, 0xce]) },
];

// Text preambles that indicate markup or code rather than a document.
const SCRIPT_PREAMBLES = ["<?php", "<script", "<%", "#!/"];

const startsWith = (buffer, signature) =>
  buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);

export const isPdfContent = (buffer) => startsWith(buffer, PDF_SIGNATURE);
export const isZipContent = (buffer) => startsWith(buffer, ZIP_SIGNATURE);

// Does the file open with something executable?
export const detectExecutablePreamble = (buffer) => {
  for (const { name, bytes } of EXECUTABLE_SIGNATURES) {
    if (startsWith(buffer, bytes)) return name;
  }
  return null;
};

// Is this plausibly text? A CSV is text by definition, so a NUL byte or an
// undecodable sequence means the name is a lie.
export const isLikelyText = (buffer) => {
  if (buffer.length === 0) return false;

  // Only a sample is needed: a binary in disguise declares itself in the first
  // few kilobytes, and scanning a 10 MB file to find one NUL byte is wasted work.
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0x00)) return false;

  // Reject if decoding introduces the replacement character, which is what
  // invalid UTF-8 becomes.
  const decoded = sample.toString("utf8");
  return !decoded.includes("\uFFFD");
};

export const hasScriptPreamble = (buffer) => {
  // Leading whitespace is skipped before comparing, so an indented shebang is
  // still caught.
  const head = buffer.subarray(0, 64).toString("utf8").trimStart().toLowerCase();
  return SCRIPT_PREAMBLES.some((preamble) => head.startsWith(preamble.toLowerCase()));
};

/**
 * Validate an uploaded document against the kind it claims to be.
 *
 * Returns `{ ok, reason }` rather than throwing so each caller can decide how to
 * report it - the multer paths answer 415, the CSV importer answers 400.
 */
export const validateDocumentContent = (buffer, kind) => {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: "The uploaded file is empty." };
  }

  const executable = detectExecutablePreamble(buffer);
  if (executable) {
    return {
      ok: false,
      reason: `The file starts with ${executable} content, so it is not a document. Upload the file as saved by your editor.`,
    };
  }

  if (kind === "pdf") {
    if (!isPdfContent(buffer)) {
      return {
        ok: false,
        reason:
          "The file does not begin with a PDF signature. It may be renamed rather than converted - open it and export it as a PDF.",
      };
    }
    return { ok: true };
  }

  if (kind === "docx") {
    if (!isZipContent(buffer)) {
      return {
        ok: false,
        reason:
          "The file is not a Word (.docx) document. Legacy .doc files and renamed files cannot be read - save it as .docx and try again.",
      };
    }
    return { ok: true };
  }

  if (kind === "csv") {
    if (!isLikelyText(buffer)) {
      return {
        ok: false,
        reason: "The file is not readable as text, so it cannot be a CSV export.",
      };
    }
    if (hasScriptPreamble(buffer)) {
      return {
        ok: false,
        reason: "The file begins with script content rather than CSV data.",
      };
    }
    return { ok: true };
  }

  // An unrecognised kind is refused rather than allowed through: a validator that
  // passes what it does not understand provides no protection.
  return { ok: false, reason: `Unsupported document kind: ${kind}` };
};

export default { validateDocumentContent, isPdfContent, isZipContent, isLikelyText, detectExecutablePreamble, hasScriptPreamble };
