import crypto from "crypto";
import fs from "fs";

// SHA-256 of an uploaded file.
//
// This is what makes "the exact file that was approved" provable rather than
// assumed. The approval is bound to a `ReportVersion`, and the final submission
// re-checks this hash, so a report cannot be silently swapped for different
// content after both supervisors approved it (integrity rules 4 and 7).
//
// Streamed rather than read whole: a 10 MB cap makes buffering survivable, but
// hashing should not become the reason that cap cannot be raised later.
const hashFile = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

export default hashFile;
