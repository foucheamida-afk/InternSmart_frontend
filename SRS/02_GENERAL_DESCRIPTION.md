# 02. General Description

**Version 2.1.0 — As-Built Edition**

## 2.1 Product Perspective

InternSmart is a self-contained full-stack web platform that coordinates four user roles around the university internship lifecycle: assignment, task execution, report drafting and AI-assisted review, supervision, meetings, dual-supervisor grading, and administrative governance.

It is not a component of a larger institutional system; it owns its own relational database and file storage, and integrates with three external services (Google Gemini, Jitsi Meet, SMTP).

### 2.1.1 Platform Context *(as built)*

```
                        ┌───────────────────────────────────────────────┐
                        │        InternSmart Web Platform               │
                        └───────────────────────┬───────────────────────┘
                                                │
     ┌───────────────┬──────────────────────────┼───────────────────────┬────────────────┐
     ▼               ▼                          ▼                       ▼                │
┌──────────┐   ┌──────────────────┐   ┌────────────────────────┐   ┌──────────────┐     │
│ Student  │   │ Academic Sup.    │   │ Professional Sup.      │   │ System Admin │     │
└────┬─────┘   └────────┬─────────┘   └───────────┬────────────┘   └──────┬───────┘     │
     │                  │                         │                       │             │
     └──────────────────┴────────────┬────────────┴───────────────────────┘             │
                                     │ REST / JSON + Bearer JWT                        │
                                     ▼                                                 │
        ┌──────────────────────────────────────────────────────────────┐                │
        │            Express 5 Application Tier                        │                │
        │  [ protect / authorize ]  [ Multer uploads ]  [ AI quota ]    │                │
        │  [ PDF text extraction ]  [ Report workspace ]  [ Cleanup ]   │                │
        └───┬──────────────────┬───────────────────┬───────────────────┘                │
            │                  │                   │                                    │
            ▼                  ▼                   ▼                                    │
   ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐                        │
   │ Google Gemini   │ │ Jitsi Meet      │ │ SMTP (Nodemailer)│                        │
   │ (report review) │ │ (meeting rooms) │ │ (account mail)   │                        │
   └─────────────────┘ └─────────────────┘ └──────────────────┘                        │
            │                                                                           │
            ▼                                                                           │
   ┌────────────────────────────────────────────────────────────────┐                   │
   │ Sequelize ORM → MySQL 8 / PostgreSQL                           │                   │
   │ Users · Students · Internships · Reports · ReportComments ·    │                   │
   │ Tasks · Meetings · Notifications · DefenseAlerts · Timelines   │                   │
   └────────────────────────────────────────────────────────────────┘                   │
                                                                                        │
   Local file storage: server/uploads/ (PDF reports, uploaded CSVs), served at /uploads ◄─┘
```

> **Not present:** the v2.0 diagram showed an "Internal Corpus / Plagiarism Index" component alongside Gemini. No such component exists — see `04_FUNCTIONAL_REQUIREMENTS.md` §4.4 and `06_IMPLEMENTATION_STATUS_AND_ROADMAP.md`.
>
> **Installed but inactive:** `socket.io` (server) and `socket.io-client` (client) are declared dependencies, but `server/config/socket.js` is a 0-byte file that `server.js` never imports, so **no real-time transport is initialised**. Client dashboards refresh by polling instead (e.g. `StudentDashboard.jsx` on a 15-second interval).

---

## 2.2 User Classes & Personas *(as built)*

### 2.2.1 Student (`student`)
An enrolled student completing an internship placement.

**Delivered capabilities**
- Upload report drafts as PDF; submission increments the report version and resets status to `submitted` (`studentController.js:186-197`).
- Draft reports in the collaborative writing workspace (`/workspace`, Tiptap-based) and request AI review of a report.
- View dashboard indicators: overall progress, AI score, submission status, pending task count, upcoming meetings (`StudentDashboard.jsx`).
- View profile metadata — matricule, class, host company, and both assigned supervisors (`GET /api/students/me`).
- View the institutional internship timeline with milestone indicators.
- Track assigned tasks, update progress 0–100 %, submit work URLs and notes, read per-role supervisor feedback.
- View meetings and join by one-click Jitsi link; receive and mark read in-app notifications.
- View final grades split into academic and professional components (`GET /api/students/my-final-grade`).

**Not delivered for this role**
- Plagiarism pre-scan of drafts (roadmap).
- Defence-alert banner with countdown — defence alerts are admin-facing only; no student endpoint exposes them (`FR-STU-01`, `FR-ADM-09`).
- ~~Self-service password reset~~ — **now delivered (2026-09-14)**: anyone can recover a forgotten password using a 6-digit code emailed to their registered address. See `FR-AUTH-04..06`.

### 2.2.2 Academic Supervisor (`academic_supervisor`)
University faculty member overseeing academic performance and report quality.

**Delivered capabilities**
- View assigned interns with progress and report state (`GET /api/supervisor/my-interns`).
- Inspect reports and the persisted AI analysis; read and write section-level report comments (`/api/workspace/reports/:id/comments`).
- Provide report feedback and drive status transitions (`PUT /api/supervisor/reports/:id/feedback`).
- Assign, update and delete tasks; give academic feedback per task (`/api/supervisor/tasks*`).
- Schedule, update, initiate and cancel meetings; participants are notified in-app (`/api/supervisor/meetings*`).
- Submit the academic grade out of 20 with a rubric breakdown (`POST /api/supervisor/interns/:studentId/grade`).

**Not delivered for this role**
- The Plagiarism Inspector modal, similarity percentages, and side-by-side snippet comparison (roadmap, `FR-PLAG-06..08`).
- The pre-grading plagiarism safeguard — final grades can be submitted with no integrity check (`FR-PLAG-09`).

### 2.2.3 Professional Supervisor (`professional_supervisor`)
Industry mentor supervising workplace execution at the host company.

**Delivered capabilities**
- View company interns (`GET /api/professional-supervisor/my-interns`) and summary statistics (`GET .../stats`).
- Create, update and delete workplace tasks with due dates; review submissions, work URLs and notes; provide professional feedback.
- Schedule, update, initiate and cancel meetings for their interns.
- Submit the workplace grade out of 10 with a rubric breakdown (`POST /api/professional-supervisor/interns/:studentId/grade`).

### 2.2.4 System Administrator (`admin`)
Institutional administrator managing accounts and platform configuration.

**Delivered capabilities**
- Dashboard statistics and chart data; user list/detail/create/update/delete and activate/deactivate.
- Create users with a generated temporary password and dispatch credentials by email; resend account emails; force a password reset.
- Bulk student onboarding from a CSV file.
- Manage internships (read), reports (read/update), meetings (CRUD), notifications (create/read) and defence alerts (create/read/update).
- Full timeline phase CRUD (list/create/update/delete).
- Delete users through a programmatic cascading cleanup across dependent tables.

**Not delivered for this role**
- Plagiarism threshold configuration, exclusion rules and corpus re-indexing (roadmap, `FR-PLAG-11`).
- Full CRUD for Students and Internships — only read endpoints exist for those collections (`FR-ADM-01`).
- A DB-level zero-orphan guarantee: no foreign keys declare `onDelete`, so integrity is enforced by application code rather than by the database (`FR-ADM-06`). The cleanup routine itself is transactional as of 2026-09-14.

---

## 2.3 Operating Environment

- **Client:** modern evergreen desktop/laptop/tablet browsers with JavaScript, ES2020+, CSS Flexbox/Grid, HTML5 WebRTC (for Jitsi) and `localStorage`/`sessionStorage`. The SPA is built with React 19 + Vite 8; build-time Node.js is required. The writing workspace depends on rich-text editor and CRDT libraries (Tiptap, Yjs).
- **Application server:** Node.js with native ES Modules — the code is `"type": "module"` throughout, so a Node version with stable ESM support (18+/20+ LTS) is required. Express 5.2.1.
- **Database:** a single relational SQL database accessed through Sequelize, using either the `mysql2` (MySQL 8) or `pg` (PostgreSQL) driver, selected by `DB_DIALECT`. Ten tables are created/updated at startup by `sequelize.sync({ force: false })` plus a series of idempotent `ensure*Columns()` migrations in `server.js:31-226`. MySQL is used for JSON columns (report content, AI analysis, rubrics, milestones, group-meeting member lists).
- **File storage:** local filesystem directory `server/uploads/`, created on startup if absent, served statically at `/uploads`. Uploaded PDFs are read back from disk for AI review.
- **Required secret material:** a database credential set, `JWT_SECRET`, SMTP credentials, and a Gemini API key.

---

## 2.4 Design & Implementation Constraints *(as built)*

1. **Stateless JWT authentication.** Identity travels in a signed JWT issued at login and sent as `Authorization: Bearer <token>`. The token carries id, name, email and role, and expires in **1 day** (`utils/generateJWT.js:13`). Middleware re-reads the user on each request and rejects accounts whose `active` flag is false.
2. **Account status is `active`, not `isBlocked`.** The boolean `active` field (`userModel.js:43-47`) governs access; v2.0 documented an `isBlocked` field that does not exist. Additional tracking fields exist: `status` (online/logged_in/…), `lastLoginAt`, `lastLogoutAt`, `deactivatedAt`, `mustChangePassword`.
3. **AI quota.** Automated AI review is rate-limited **per student per UTC calendar day**, enforced server-side with HTTP 429 on exhaustion. The effective cap is **5**, not the 3 documented in v2.0 (`utils/aiQuota.js:3`). The same counter is shared by report review and the writing assistant, and is stored on the `Student` row (`aiRequestsToday`, `aiRequestsDate`).
4. **Single active report per student, with versions.** Submitting a new draft increments `version` and resets `status` to `submitted`. Reports are keyed to the student, not to the internship.
5. **Report text is stored as a structured document, not plain text.** `Reports.documentContent` is a `JSON` column holding an editor document tree (ProseMirror/TipTap), not `LONGTEXT` plain text as v2.0 specified. AI review re-extracts text from the stored PDF rather than reading this column.
6. **Cascading deletion is programmatic, and now transactional.** No model declares `onDelete`/`references` constraints; `association.js` declares `foreignKey` and `as` only. Cleanup is hand-written in `adminController.js` and, since 2026-09-14, runs inside a single database transaction, so a mid-sequence failure rolls back instead of leaving partial state. Database-level referential integrity is still absent.
7. **Two divergent upload configurations.** Report PDFs are validated by one Multer instance and CSVs by another; size limits differ (see `NFR-SEC-04`).
8. **Configuration via environment variables.** Database, JWT, SMTP and Gemini settings are read from the environment; keys are listed in §2.5.

---

## 2.5 Assumptions & Dependencies

**External services**
- **SMTP (Nodemailer)** — required to deliver account credentials, account-email resends and defence-alert notifications. Configured by `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`. Connection is verified at startup and failure is logged as a warning without stopping the server (`server.js:265-277`). *(v2.0 documented `SMTP_*` names; the real names are `EMAIL_*`.)*
- **Google Gemini API** (`@google/genai`) — required for AI report review. Configured by `GEMINI_API_KEY`, with optional `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` overrides. The code defaults to a primary model with an automatic **fallback model** and up to three retries; prompts are truncated at ~120 000 characters. *(v2.0 specified "Gemini 2.5" as the model; the default is not 2.5.)*
- **Jitsi Meet** — meeting rooms are generated as public `meet.jit.si` URLs. Availability and privacy depend on that public service, or a self-hosted substitute configured in code.
- **Database** — `DB_DIALECT`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. `JWT_SECRET` is required for token signing.

**Assumptions**
- PDF reports contain an extractable text layer. Image-only/scanned PDFs yield no usable text without OCR, which is not implemented.
- The configured Gemini model is reachable and within quota. No offline or degraded AI path exists beyond returning an error to the client.
- Schema evolution relies on the startup `ensure*Columns()` routines plus `sync({ force: false })`; there is no migration framework, so column additions must be hand-written.
- A `deepseek_api_key` entry exists in `server/.env` but is **not referenced by any server code** — it is inert configuration.

**Known environment-dependent fragility**
- ~~`authController.js:3` imports `../utils/generatejwt.js` while the file on disk is `generateJWT.js`.~~ **Fixed 2026-09-14** — the import now matches case-exactly, so login works on case-sensitive Linux; a repo-wide sweep of 308 relative imports across 132 files found no other mismatch.
