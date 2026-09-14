import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, per NFR-SEC-04

// Files are buffered in memory: the AI endpoints parse the PDF straight from the
// buffer and never need it written to disk.
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    // This was 20 MB, which exceeded the 10 MB cap required by NFR-SEC-04 - and
    // since it is the uploader for /api/ai/*, a single request could buffer 20 MB
    // of RAM. Now aligned with the documented limit.
    fileSize: MAX_FILE_SIZE_BYTES,
  },

  fileFilter: (req, file, cb) => {
    // Exact MIME allow-list (not an extension check).
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  },
});

// Multer reports limit violations as a MulterError, which Express surfaces as an
// opaque 500. Translating them means the cap is actually communicated.
// Exported as an object with `single` so existing `upload.single(...)` call sites
// keep working unchanged.
const single = (field) => (req, res, next) =>
  upload.single(field)(req, res, (error) => {
    if (!error) return next();

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
export default { single };
