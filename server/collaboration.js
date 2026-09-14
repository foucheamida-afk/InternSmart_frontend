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
  // STATUS: NOT WORKING — do not rely on this yet. Both attempts are recorded
  // because each is instructive:
  //
  //   1. Throwing from `onChange` does not reject a change. Hocuspocus logs it and
  //      the rejection surfaces as an unhandled error that kills the process
  //      (observed: exit code 1 immediately after the first read-only write).
  //   2. Filtering inbound Sync / SyncReply here did NOT stop the update either —
  //      in testing a supervisor's edit still reached the student's document
  //      ("STUDENT WRITES THIS | SUPERVISOR EDIT"), so incremental updates clearly
  //      do not arrive under those message types. The rejection itself is clean
  //      (the server stayed up), it simply does not cover the update path.
  //
  // Consequence: until this is solved, treat supervisors as ABLE TO EDIT. The
  // client marks them read-only, but that is presentation, not enforcement. The
  // likely correct fix is to inspect the decoded update payload (or the document
  // transaction origin) rather than the message type, or to give supervisors a
  // non-writable replica and persist their input as a separate suggestion layer.
  async beforeHandleMessage({ context, messageType }) {
    if (!context?.readOnly) return;

    const MESSAGE_TYPE_SYNC = 0;
    const MESSAGE_TYPE_SYNC_REPLY = 4;

    if (messageType === MESSAGE_TYPE_SYNC || messageType === MESSAGE_TYPE_SYNC_REPLY) {
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
