import path from "path";
import fs from "fs";

// Absolute filesystem path for a stored upload.
//
// Uploads are written to `<cwd>/uploads` by the Multer configuration, and the
// database stores only the public `/uploads/<name>` fragment.
export const absolutePathFor = (fileUrl) => {
  if (!fileUrl) return null;
  const filename = path.basename(fileUrl);
  const candidates = [
    path.join(process.cwd(), "uploads", filename),
    path.resolve(process.cwd(), "..", "uploads", filename),
    path.resolve(process.cwd(), "server", "uploads", filename),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return candidates[0];
};

export default absolutePathFor;
