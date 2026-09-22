import { sequelize } from "../config/db.js";

/**
 * How large a converted report may be before it cannot be stored.
 *
 * A Word report is not stored as the .docx: `submitReport` converts it into
 * editor content (mammoth -> JSON, with every embedded image inlined as a base64
 * data URI) and that JSON is what `Reports.documentContent` holds. It is
 * therefore much larger than the file - measured on a real document, a 4.5 MB
 * screenshot becomes 6.0 MB of JSON (1.33x, the base64 tax), and 5 MB of plain
 * text becomes 5.0 MB of JSON even though the .docx compresses to 0.1 MB.
 *
 * That value travels to the database in a *single* statement, so it is bounded
 * by the server's `max_allowed_packet` - and MariaDB's default in an XAMPP-style
 * install is 1 MB. Exceeding it does not produce a readable error: the server
 * drops the connection and the client sees only `ECONNRESET`, which is how a
 * 5 MB Word upload became an unexplained 500. Worse, the reset also tears down a
 * pooled connection in the middle of an unrelated request.
 *
 * So the size is checked *before* the write, and a document that cannot be
 * stored is refused with a message that says what to do. Two bounds apply:
 *
 *   REPORT_CONTENT_MAX_MB   the application's own ceiling for stored content.
 *                           Defaults to 16 MB, which covers the worst case of
 *                           the 10 MB upload cap (10 MB of images -> ~13.3 MB).
 *   @@max_allowed_packet    what the database will actually accept right now.
 *
 * The effective limit is the smaller of the two, so the guard is correct both on
 * a default install (where it fires and explains itself) and on a tuned one
 * (where the upload simply succeeds). Detection is cached because the session
 * value is fixed when a connection is opened: if an operator raises the server
 * setting, the running process keeps the old value until it reconnects, and
 * caching mirrors that reality rather than pretending otherwise.
 */

const DEFAULT_MAX_CONTENT_MB = 16;
const PACKET_HEADROOM_BYTES = 64 * 1024; // the rest of the statement is a few hundred bytes

const configuredMaxBytes = () => {
  const raw = Number(process.env.REPORT_CONTENT_MAX_MB);
  const megabytes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_CONTENT_MB;
  return Math.floor(megabytes * 1024 * 1024);
};

let packetLimitPromise = null;

/** The server's packet ceiling, or null when it cannot be read. */
export const detectPacketLimit = async () => {
  if (!packetLimitPromise) {
    packetLimitPromise = sequelize
      .query("SELECT @@max_allowed_packet AS packet")
      .then(([rows]) => Number(rows?.[0]?.packet) || null)
      .catch((error) => {
        console.warn("Could not read @@max_allowed_packet; falling back to the configured report size ceiling:", error.message);
        packetLimitPromise = null;
        return null;
      });
  }
  return packetLimitPromise;
};

/** Bytes of editor content a single write may carry. */
export const storableContentBytes = async () => {
  const configured = configuredMaxBytes();
  const packet = await detectPacketLimit();
  if (!packet) return configured;
  return Math.max(1024, Math.min(configured, packet - PACKET_HEADROOM_BYTES));
};

const toMegabytes = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/** Serialised size of the editor content exactly as the column would receive it. */
export const measureDocumentContent = (documentContent) => {
  if (documentContent === null || documentContent === undefined) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(documentContent), "utf8");
  } catch {
    return 0;
  }
};

/**
 * Is this document small enough to store?
 *
 * Returns the numbers as well as the verdict so every caller can put the real
 * figures in front of the user instead of "something went wrong".
 */
export const checkStorableDocumentContent = async (documentContent) => {
  const bytes = measureDocumentContent(documentContent);
  const limit = await storableContentBytes();
  return { bytes, limit, tooLarge: bytes > limit };
};

/**
 * The message a student or supervisor sees. It has to name the two things they
 * can actually do, because "the report is too big" alone leaves them stuck.
 */
export const tooLargeMessage = ({ bytes, limit }, { subject = "This report's editable content" } = {}) =>
  `${subject} is about ${toMegabytes(bytes)} MB, which is larger than this server can store in one write `
  + `(${toMegabytes(limit)} MB). Upload the report as a PDF instead, or ask your administrator to raise the `
  + `database's max_allowed_packet setting.`;

/**
 * Called once at startup. A database that cannot hold a converted report turns
 * every Word upload into a 500, so the reason belongs in the boot log rather
 * than in a support request.
 */
export const warnIfReportsCannotBeStored = async () => {
  const packet = await detectPacketLimit();
  const configured = configuredMaxBytes();
  if (!packet) return;
  if (packet >= configured) return;

  console.warn(
    `Database max_allowed_packet is ${toMegabytes(packet)} MB, below the ${toMegabytes(configured)} MB this `
    + "application may store for a report. Word reports whose converted content is larger will be refused with "
    + "REPORT_CONTENT_TOO_LARGE. Raise max_allowed_packet (for XAMPP: my.ini, [mysqld], "
    + "max_allowed_packet=64M), then restart the database and this server.",
  );
};

export default {
  detectPacketLimit,
  storableContentBytes,
  measureDocumentContent,
  checkStorableDocumentContent,
  tooLargeMessage,
  warnIfReportsCannotBeStored,
};
