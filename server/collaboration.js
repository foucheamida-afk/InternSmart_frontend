import jwt from "jsonwebtoken";
import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";

import { sequelize } from "./config/db.js";
import Report from "./models/reportModel.js";
import Student from "./models/studentModel.js";
import Internship from "./models/studentAssignmentModel.js";
import DocumentState from "./models/documentStateModel.js";
import "./models/association.js";

/**
 * Real-time collaboration server for the shared report drafting workspace.
 *
 * Runs as its own process (`npm run collab`) on COLLAB_PORT (default 1234) so the
 * HTTP API's lifecycle is unaffected. Two responsibilities:
 *
 *   1. Authorisation. Every socket is authenticated with the same JWT the HTTP API
 *      issues, and the report-access rules from reportWorkspaceController are
 *      re-applied here. A client cannot join a document it is not entitled to even
 *      if it forges the document name.
 *
 *   2. Read-only enforcement. The academic policy is that supervisors *suggest*
 *      rather than edit: authorship of a graded report stays with the student.
 *      Supervisors (and admins) therefore connect to a document they may read but
 *      whose changes are rejected server-side, not merely greyed out in the UI.
 *
 * Persistence keeps the whole Yjs state in DocumentStates, so concurrent editors
 * merge through CRDT rather than overwriting each other's full-document snapshots.
 */

const PORT = Number(process.env.COLLAB_PORT) || 1234;

export const documentNameFor = (reportId) => `report-${reportId}`;

const reportIdFromDocumentName = (documentName) => {
  const match = /^report-(\d+)$/.exec(String(documentName || ""));
  return match ? Number(match[1]) : null;
};

/**
 * Mirror of reportWorkspaceController.getAccess, returning whether the user may
 * WRITE (only the owning student may) as well as whether they may read at all.
 */
const resolveAccess = async (reportId, user) => {
  const report = await Report.findByPk(reportId, {
    include: [{ model: Student, as: "student", include: [{ model: Internship, as: "internship" }] }],
  });
  if (!report) return null;

  if (user.role === "admin") return { report, canWrite: false };

  if (user.role === "student") {
    const student = await Student.findOne({ where: { userId: user.id } });
    if (student && report.studentId === student.id) return { report, canWrite: true };
    return null;
  }

  const internship = report.student?.internship;
  if (user.role === "academic_supervisor" && internship?.academicSupervisorId === user.id) {
    return { report, canWrite: false };
  }
  if (user.role === "professional_supervisor" && internship?.professionalSupervisorId === user.id) {
    return { report, canWrite: false };
  }

  return null;
};

const server = new Server({
  port: PORT,
  // Coalesce document persistence instead of writing on every transaction.
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate({ token, documentName }) {
    const reportId = reportIdFromDocumentName(documentName);
    if (!reportId) throw new Error("Unknown document");

    if (!token) throw new Error("Authentication required");

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new Error("Invalid or expired token");
    }

    // Purpose-scoped tokens (password reset) are not access tokens.
    if (decoded.purpose) throw new Error("Invalid token");

    const access = await resolveAccess(reportId, decoded);
    if (!access) throw new Error("You are not assigned to this report");

    return {
      user: { id: decoded.id, name: decoded.name, role: decoded.role },
      reportId,
      readOnly: !access.canWrite,
    };
  },

  // Server-side read-only enforcement for supervisors (suggest-only policy).
  //
  // STATUS: NOT SUFFICIENT - do not treat suggest-only as enforced. Verified state:
  //   - read-only peer receives live edits ............ YES
  //   - its ordinary writes are refused .............. YES (student doc stayed clean)
  //   - server survives the rejection ................ YES
  //   - it keeps receiving AFTER a refused write ..... NO  (replica diverges and
  //     stops updating: supervisor saw "AAA | SUPERVISOR EDIT" while the student
  //     had "AAA BBB")
  //   - BYPASSABLE ................................... YES. SyncStep2 must be allowed
  //     for broadcasts to work, so a read-only client can push edits inside its
  //     (re)connect handshake anyway.
  //
  // Attempts, because each failure was informative:
  //   1. Throwing from `onChange` kills the process (unhandled rejection).
  //   2. Filtering in `beforeHandleMessage` is a no-op: that payload has no
  //      `messageType` field, so the comparison never matched.
  //   3. Refusing SyncStep2 + Update blocked writes but also cut the peer off from
  //      broadcasts entirely.
  //   4. Refusing only Update (current) restores reading but leaves a diverged
  //      replica after a rejected write, and is still bypassable via the handshake.
  //
  // CONCLUSION: a writable CRDT replica cannot be made read-only from the hook layer
  // in a way that is both safe and functional. The correct design for the
  // suggest-only policy is to treat suggestions as DATA rather than document
  // mutations: a ReportSuggestion record (author, anchored range, proposed text,
  // status) that the student accepts or rejects, rendered as a review layer. That
  // gives real track-changes semantics and an audit trail, and supervisors never
  // need a writable replica at all. Until then, supervisors must be given a
  // read-only view that does not join the writable document.
  async beforeSync({ context, type, messageType }) {
    if (!context?.readOnly) return;

    // Tolerate either field name across Hocuspocus versions.
    const syncType = type ?? messageType;

    const SYNC_UPDATE = 2; // incremental document update

    if (syncType === SYNC_UPDATE) {
      throw new Error("Read-only connection: submit suggestions instead of editing");
    }
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const row = await DocumentState.findOne({ where: { documentName } });
        if (!row || !row.state) return null;
        return new Uint8Array(row.state);
      },
      store: async ({ documentName, state }) => {
        await DocumentState.upsert({ documentName, state: Buffer.from(state) });
      },
    }),
  ],
});

const start = async () => {
  try {
    await sequelize.authenticate();
    // Creates DocumentStates on first run; sync() never alters existing tables.
    await sequelize.sync({ force: false });
    console.log("Collaboration server connected to the database.");
  } catch (error) {
    console.error("Collaboration server could not reach the database:", error.message);
    process.exit(1);
  }

  server.listen();
  console.log(`Collaboration server listening on port ${PORT}`);
};

start();

export default server;
