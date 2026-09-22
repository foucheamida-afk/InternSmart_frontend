import path from "path";

// Absolute filesystem path for a stored upload.
//
// Uploads are written to `<cwd>/uploads` by the Multer configuration, and the
// database stores only the public `/uploads/<name>` fragment. Several services
// need to turn one into the other, so it lives in one place rather than being
// re-derived per caller.
//
// `path.basename` is applied deliberately: the stored value comes from the
// database but originates from an upload, and stripping any directory component
// prevents a crafted value from escaping the uploads directory.
export const absolutePathFor = (fileUrl) => {
  if (!fileUrl) return null;
  return path.join(process.cwd(), "uploads", path.basename(fileUrl));
};

export default absolutePathFor;
