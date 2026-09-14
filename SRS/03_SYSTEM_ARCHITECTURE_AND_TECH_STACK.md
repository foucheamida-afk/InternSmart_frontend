# 03. System Architecture & Tech Stack

**Version 2.1.0 — As-Built Edition**

## 3.1 Architectural Overview

InternSmart is a decoupled client-server web application. The client is a React single-page application; the server is an Express REST API. They communicate exclusively over HTTP with JSON payloads and a JWT bearer token. There is no server-rendered tier, no message broker, and no real-time transport in operation.

### 3.1.1 Component Blueprint *(as built)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT TIER (SPA)                                 │
│  React 19 · Vite 8 · react-router-dom 7 · Tailwind 4 + CSS token system       │
│  Axios instance with JWT request interceptor · lucide-react · framer-motion   │
│  Pages: Landing · Login · Student/Supervisor/Professional/Admin dashboards    │
│         Writing Workspace (Tiptap + Yjs) · AI Feedback · Reports · Settings   │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ HTTP / REST / JSON · Authorization: Bearer <JWT>
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION TIER (Express 5)                        │
│  Routes → [ protect (JWT) ] → [ authorize(role) ] → Controllers               │
│                                                                              │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐   │
│  │ Upload middleware  │  │ PDF text extraction  │  │ AI quota manager   │   │
│  │ multer (3 configs) │  │ pdf-parse            │  │ 5 / student / day  │   │
│  └────────────────────┘  └──────────────────────┘  └────────────────────┘   │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐   │
│  │ Report workspace   │  │ Gemini review        │  │ Cleanup routine    │   │
│  │ comments, content  │  │ + fallback model     │  │ (transactional)   │   │
│  └────────────────────┘  └──────────────────────┘  └────────────────────┘   │
└───────┬──────────────────────────┬──────────────────────────┬────────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌──────────────────┐    ┌──────────────────┐      ┌────────────────────────┐
│ Sequelize ORM    │    │ Google Gemini    │      │ Jitsi Meet (meeting    │
│ (10 models)      │    │ (@google/genai)  │      │ URLs) · SMTP mailer    │
└───────┬──────────┘    └──────────────────┘      └────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DATA TIER                                           │
│  MySQL 8 (dialect hardcoded) via mysql2 · pg installed but unreachable        │
│  Users · Students · Internships · Reports · ReportComments · Tasks ·          │
│  Meetings · Notifications · DefenseAlerts · TimelineSettings                  │
│  Local filesystem: server/uploads/  →  served statically at /uploads          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Absent from v2.0's blueprint:**
- **Internal Plagiarism Engine / Corpus Index** — does not exist (`server/services/plagiarismService.js` is 0 bytes). See §3.2.6.
- **Real-time layer** — `socket.io` is declared as a dependency but `server/config/socket.js` is empty and `server.js` never initialises it. Clients poll instead.

### 3.1.2 Request Lifecycle

1. `POST /api/users/login` verifies credentials with `bcrypt.compare`, checks the `active` flag, and returns a JWT carrying `id`, `name`, `email`, `role` (1-day expiry).
2. The client persists the token and an Axios interceptor attaches `Authorization: Bearer <token>` to subsequent requests.
3. `protect` verifies the token, then **re-reads the user row** (`User.findByPk`) to confirm the account is still active and to obtain the current role.
4. `authorize(...roles)` compares the role to the route's allow-list, returning 401 when unauthenticated and 403 on a role mismatch.
5. The controller executes business logic, and any Multer-processed file is written to `server/uploads/` (or buffered in memory on the AI routes).
6. Errors propagate to the client as HTTP status codes with ad-hoc JSON bodies — no standard envelope is used (§5.5, `NFR-MNT-04`).

---

## 3.2 Technology Stack *(as built)*

### 3.2.1 Client Tier

| Concern | Technology | Version |
| :--- | :--- | :--- |
| UI framework | React / React DOM | 19.2.8 |
| Build tool | Vite | 8.2.0 |
| Routing | react-router-dom | 7.18.2 |
| Styling | Tailwind CSS + `@tailwindcss/vite` | 4.3.3 |
| HTTP | Axios | 1.19.0 |
| Icons | lucide-react (also react-icons) | 1.31.0 |
| Animation | framer-motion | 13.1.0 |
| Rich-text editor | Tiptap (`@tiptap/react`, starter-kit, extensions: table, link, image, color, highlight, typography) | 3.30.5 – 3.31.2 |
| Collaboration (CRDT) | Yjs, y-indexeddb, y-protocols, `@hocuspocus/provider` | 13.6.32 / 9.0.12 / 1.0.7 / 4.6.0 |
| Export | html2canvas, jspdf | 1.4.1 / 4.2.1 |
| Realtime client | socket.io-client | 4.8.3 *(unused — no server endpoint)* |

> **Note:** the delivered writing workspace is an **editable collaborative rich-text editor**, not the read-only split-screen text view described in v2.0. The live router is **`client/src/App.jsx`**; `client/src/router/AppRouter.jsx` is legacy dead code.

### 3.2.2 Application Tier

| Concern | Technology | Version |
| :--- | :--- | :--- |
| Runtime | Node.js, native ES Modules (`"type": "module"`) | no `engines` pin; verified on v24.21.0 |
| Web framework | Express | 5.2.1 |
| ORM | Sequelize — declared and installed locally | ^6.37.8 *(was undeclared; fixed 2026-09-14, see §3.2.5)* |
| DB drivers | mysql2 (used), pg (installed, unused) | 3.23.4 / 8.23.0 |
| Authentication | jsonwebtoken | 9.0.3 |
| Password hashing | bcrypt (cost 10) | 6.0.0 |
| File uploads | Multer (three separate configurations) | 2.2.0 |
| PDF parsing | pdf-parse (used as the `PDFParse` class) | 2.4.5 |
| CSV parsing | csv-parser | 3.2.1 |
| Email | Nodemailer | 9.0.4 |
| Realtime (server) | socket.io + `@hocuspocus/server` | 4.8.3 / 4.6.0 *(unused — `config/socket.js` is empty)* |
| Testing | mocha, chai, supertest | 12.x / 6.x / 7.x |

### 3.2.3 Document Processing & AI

- **Extraction:** `utils/extractPdfText.js` instantiates `PDFParse` and converts the extracted text into a **structured editor document tree**, which is stored in the `Reports.documentContent` JSON column.
- **Review:** `services/geminiService.js` submits the report text to Google Gemini using a structured prompt (`prompts/reportReviewPrompt.js`) that requests five 0–100 scores plus categorised issues and strengths. The response is parsed in the controller and persisted to `Reports.aiAnalysis` (with `aiScore` derived by dividing the overall score by 10).
- **Resilience:** up to three attempts with backoff, a **fallback model** call, and prompt truncation at roughly 120 000 characters. The call is **synchronous inside the HTTP request** — there is no background job.
- **Quota:** enforced server-side by `utils/aiQuota.js` — **5 requests per student per UTC calendar day**, shared between report review and the writing assistant, persisted on the `Student` row.

### 3.2.4 External Services

| Service | Purpose | Configuration |
| :--- | :--- | :--- |
| Google Gemini (`@google/genai`) | Report review, writing assistant | `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` |
| Jitsi Meet (`meet.jit.si`) | Meeting rooms | Room URL derived from meeting title + id + timestamp (no hash) |
| SMTP (Nodemailer) | Account credentials, defence alerts | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` |

### 3.2.5 Dependency Integrity

**Resolved 2026-09-14.** `sequelize ^6.37.8` is now declared in `server/package.json`, recorded in `server/package-lock.json`, and installed in `server/node_modules`. The fix was verified by temporarily hiding the out-of-project copy at `C:\Users\simeb\node_modules\sequelize` and confirming the API still starts, connects (`Database connected successfully.`) and listens on port 3000 — so the project no longer depends on an accidental ancestor install, and a clean `npm ci && npm start` can now resolve the ORM.

*Original defect, for the record:* `sequelize` was imported by 11 source files but was undeclared and uninstalled; it resolved only through that stray ancestor copy, so a clean checkout failed with `ERR_MODULE_NOT_FOUND` and the API could not boot.

**Resolved 2026-09-14:** `config/db.js` now reads `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` and `DB_DIALECT` from the environment (with behaviour-preserving fallbacks), so the `DB_*` keys in `server/.env` are actually used and the app can be pointed at another database without code edits. PostgreSQL remains unreachable in practice because `.env` sets `DB_DIALECT=mysql`, though the driver is installed.

**Also fixed 2026-09-14 — fresh-database bootstrap.** `server.js` previously ran its `ensure*Columns()` helpers *before* `sequelize.sync()`. Because those helpers call `queryInterface.describeTable()` on tables they assume exist, a brand-new database aborted startup with `No description found for "Tasks" table`, so the app could only ever run against an already-provisioned schema. `sync({ force: false })` now runs first; it is safe for existing databases (it leaves existing tables untouched) and the helpers still add any missing columns afterwards. Verified by bootstrapping a completely empty database.

**MariaDB JSON caveat — fixed centrally 2026-09-14.** MariaDB implements the `JSON` type as `LONGTEXT`, so Sequelize returns JSON columns as **strings**, not parsed objects. Verified directly: `Reports.aiAnalysis` came back as a **13,949-character string**, `Reports.documentContent` as a string, and `TimelineSettings.milestones` as the string `"[]"`. Any consumer that assumed an array or object silently failed — `aiAnalysis.metrics` was `undefined`, and `milestones.map(...)` would have thrown. This had already caused one confirmed bug (group-meeting pruning in `deleteUser` never ran) and had been patched piecemeal: `timelineController.parseMilestones` carries the comment *"MySQL returns JSON columns as strings"*, and two client components parse defensively.

`config/db.js` now registers a global `afterFind` hook that parses any JSON-typed attribute arriving as a string, so every consumer — controllers and API responses alike — sees the same shape native MySQL would return. Verified afterwards: `aiAnalysis.metrics.structure` resolves to `75`, `aiAnalysis.suggestions.length` to `18`, and `documentContent` round-trips as a `{ type: 'doc' }` object. New code cannot reintroduce this class of bug.

### 3.2.6 Internal Plagiarism Engine — **NOT PRESENT**

v2.0 specifies a five-stage detection pipeline (preprocessing, k-gram fingerprinting, MinHash/Jaccard candidate matching, TF-IDF cosine vectorisation, optional Gemini paraphrase spotting). **None of it exists.**

| Expected component | Status |
| :--- | :--- |
| `services/plagiarismService.js` | **0 bytes**, imported nowhere |
| N-gram / Jaccard / TF-IDF / cosine / hashing code | absent (no matches repo-wide in server JS) |
| `PlagiarismScan` / `PlagiarismMatch` / `DocumentFingerprint` models | absent |
| Similarity thresholds (15 % / 25 %) and status enum | absent |
| Scan trigger on submission/version increment | absent |
| Supervisor Plagiarism Inspector UI | absent |
| Admin threshold configuration / corpus re-index endpoint | absent |
| Pre-grading safeguard and override note | absent |

Retained as roadmap in `04_FUNCTIONAL_REQUIREMENTS.md` §4.4.

---

## 3.3 Database Schema & Entity Relationships

The platform persists **10 entities** (v2.0 documented 13). Tables are named by Sequelize's default PascalCase plural convention; no model sets `tableName` or `underscored`.

### 3.3.1 Entity Relationship Diagram

```
[ User ] (id, name, email, password, role, mustChangePassword, active, status, lastLoginAt, lastLogoutAt, deactivatedAt)
   │
   ├── (1:1) ──► [ Student ] (id, userId, matricule, class, aiRequestsToday, aiRequestsDate)
   │               │
   │               ├── (1:1) ──► [ Internship ] (id, studentId, academicSupervisorId, professionalSupervisorId,
   │               │                             company, academicGrade*, professionalGrade*, legacy finalGrade*)
   │               │
   │               ├── (1:N) ──► [ Report ] (id, studentId, title, fileName, fileUrl, version, status,
   │               │               │           progress, aiScore, aiAnalysis, documentContent, supervisorFeedback*)
   │               │               └── (1:N) ──► [ ReportComment ] (id, reportId, userId, section, body)
   │               │
   │               ├── (1:N) ──► [ Task ] (id, studentId, supervisorId, title, description, dueDate, status,
   │               │                       completed, progress, workUrl, submissionNote, feedback*)
   │               ├── (1:N) ──► [ Meeting ] (id, title, description, date, location, meetingLink, status,
   │               │                          createdBy, studentId, studentIds, isGroupMeeting)
   │               └── (1:N) ──► [ DefenseAlert ] (id, studentId, title, message, defenseDate, status)
   │
   └── (1:N) ──► [ Notification ] (id, userId, title, message, type, isRead, meetingLink)

[ TimelineSetting ] (id, label, startDate, endDate, milestones) — standalone, not associated
```

### 3.3.2 Entity Specifications

**1. `Users`**

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | INTEGER | PK, auto-increment |
| `name`, `email`, `password` | STRING | `email` unique; `password` stores a bcrypt hash |
| `role` | ENUM | `student`, `academic_supervisor`, `professional_supervisor`, `admin` |
| `mustChangePassword` | BOOLEAN | default `true` — drives the first-login redirect |
| `active` | BOOLEAN | default `true` — **the access-control flag** (v2.0 called it `isBlocked`) |
| `status` | ENUM | `online`, `offline`, `logged_in`, `logged_out`, `deactivated` |
| `lastLoginAt`, `lastLogoutAt`, `deactivatedAt` | DATE | nullable session tracking |
| ~~`isBlocked`, `otpCode`, `otpExpires`~~ | — | **specified in v2.0, do not exist** |

**2. `Students`** — `id`; `userId` (unique); `matricule` (unique); `class`; `aiRequestsToday` (default 0); `aiRequestsDate` (DATEONLY). The last two implement the AI quota (not in v2.0).

**3. `Internships`** (defined in `models/studentAssignmentModel.js`) — `studentId`; `academicSupervisorId`; `professionalSupervisorId`; `company`; `academicGrade`, `academicGradeBreakdown`, `academicGradeStatus`, `academicGradeSubmittedAt`, `academicGradeSubmittedBy`; `professionalGrade`, `professionalGradeBreakdown`, `professionalGradeStatus`, `professionalGradeSubmittedAt`, `professionalGradeSubmittedBy`.
> Also carries `finalGrade`, `gradeBreakdown`, `gradeStatus`, `gradeSubmittedAt` and `gradeSubmittedBy`. These were unused legacy columns until 2026-09-14; they now hold the **composite final mark** (academic ⅔ + professional ⅓, projected onto 0–20) computed by `utils/gradeCalculator.js`, so the combined grade has a single storage location.

**4. `Reports`** — `title`; `fileName`; `fileUrl` (nullable); `version` (default 1); `status` ENUM(`submitted`, `ai_analysis`, `in_review`, `approved`, `needs_revision`, `rejected`) default `submitted`; `progress` (nullable, no default); `aiScore`; `aiAnalysis` (JSON); `documentContent` (**JSON editor tree — v2.0 specified LONGTEXT plain text**); `submittedAt`; `supervisorFeedback`, `supervisorFeedbackBy`, `supervisorFeedbackAt`.
> `studentId` is **not declared** on the model; it exists only through the `Report.belongsTo(Student)` association. The v2.0 `draft` status does not exist.

**5. `ReportComments`** — `reportId`; `userId`; `section` STRING(120); `body` TEXT; composite index on `(reportId, section)`.
> v2.0 specified a single `comment` field.

**6. `Tasks`** — `studentId`; `supervisorId`; `title`; `description` (nullable); `dueDate` (nullable); `status` **STRING** (not ENUM) default `pending`; `completed` BOOLEAN; `progress` INTEGER default 0; `submittedAt`; `submissionNote`; `workUrl`; `feedback`, `feedbackAt`; `feedbackAcademic`, `feedbackAcademicAt`, `feedbackAcademicBy`; `feedbackProfessional`, `feedbackProfessionalAt`, `feedbackProfessionalBy`.
> Dual per-role feedback columns are not in v2.0. **No `priority` field exists.**

**7. `Meetings`** — `title`; `description`; `date`; `location`; `meetingLink` (nullable); `status` ENUM(`scheduled`, `completed`, `cancelled`) — **no `active` state exists**; `createdBy`; `studentId` (nullable); `studentIds` (JSON array for group meetings); `isGroupMeeting` BOOLEAN.

**8. `Notifications`** — `userId`; `title`; `message` (**TEXT**); `type` ENUM(`info`, `warning`, `success`, `error`); `isRead` BOOLEAN; `meetingLink` (nullable).

**9. `DefenseAlerts`** — `studentId`; `title`; `message`; `defenseDate` (nullable); `status` ENUM(`pending`, `scheduled`, `completed`, `cancelled`).
> **v2.0's `location` and `juryMembers` fields do not exist**, and the status enum differs from the specified `scheduled`/`completed`/`postponed`.

**10. `TimelineSettings`** — `label`; `startDate`; `endDate`; `milestones` (JSON). All nullable. Not wired into `association.js`.

**Entities specified in v2.0 but absent:** `PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`.

### 3.3.3 Referential Integrity

**Correction (2026-09-14).** No model explicitly declares `onDelete`, `onUpdate` or `references` — all 14 association pairs in `models/association.js` specify only `foreignKey` and `as`. **However, Sequelize infers `references` from those associations, so `sequelize.sync()` does create real foreign keys**, choosing `CASCADE` or `SET NULL` according to whether the column is nullable. A freshly synced schema carries **13 FK constraints**; the live `internsmart` database carries only **7**, because `sync({ force: false })` never adds constraints to tables that already exist. The constraints missing from the live database are `internships→students`, `internships→users` (both supervisor columns), `meetings→students` and `tasks→users` — for those tables, referential integrity is application-level only.

Two consequences worth noting:

- **`reports→students` is `SET NULL`, not `CASCADE`.** Deleting a student at the database level would therefore *orphan* their reports with a null `studentId` rather than remove them. This is exactly why the programmatic cleanup in `adminController.js` — which deletes reports before the student, inside a transaction — is required to satisfy `FR-ADM-05`.
- Because the deletion routine is the only complete guarantee, `NFR-REL-02` depends on that code rather than on the schema.

See `NFR-REL-01` and `NFR-REL-02`.

### 3.3.4 Schema Evolution

There is **no migration framework**. At startup `server.js:31-226` runs a series of idempotent `ensure*Columns()` helpers — each describing a table and adding missing columns — followed by `sequelize.sync({ force: false })`, which creates missing tables but does not alter existing ones. New columns must therefore be hand-written into those helpers.

---

## 3.4 REST API Surface

### 3.4.1 Mount Points (`server.js:229-243`)

| Prefix | Router |
| :--- | :--- |
| `/api/test` | `testRoutes` (development diagnostics) |
| `/api/ai` | `aiRoutes` |
| `/api/users` | `authRoutes` **and** `passwordRoutes` (same prefix, mounted sequentially) |
| `/api/students` | `studentRoutes` |
| `/api/admin` | `adminRoutes` |
| `/api/supervisor` | `supervisorRoutes` **and** `supervisorTaskRoutes` |
| `/api/professional-supervisor` | `professionalSupervisorRoutes` |
| `/api/meetings` | `meetingRoutes` |
| `/api/timeline` | `timelineRoutes` |
| `/api/workspace` | `reportWorkspaceRoutes` |
| `/uploads` | static file serving |

> **`server/routes/reportRoutes.js` is never mounted** — and is 0 bytes.

### 3.4.2 Endpoint Inventory

**Authentication & password** — `POST /api/users/login` · `POST /api/users/logout` (protected) · `GET /api/users/:id` (admin) · `PUT /api/users/change-password` (protected) · `POST /api/users/forgot-password` (public — see the defect in `FR-AUTH-04`).

**AI** — `POST /api/ai/review` · `POST /api/ai/review-report` · `POST /api/ai/writing-assistant` · `GET /api/ai/writing-assistant/quota`. All require `protect` **and** a role guard (`student`, `academic_supervisor`, `professional_supervisor`) and are capped at 10 MB with an exact `application/pdf` MIME check. *(Both the role guard and the 10 MB cap were added on 2026-09-14; the path previously had no role guard and a 20 MB limit — see `NFR-SEC-03` and `NFR-SEC-04`.)*

**Student** (`/api/students`, role `student`) — `GET /me` · `GET /dashboard-stats` · `GET /my-reports` · `POST /reports` · `DELETE /reports/:id` · `POST /reports/:id/send-to-supervisor` · `POST /reports/:id/send-to-ai` · `GET /my-final-grade` · `GET /my-supervisor-feedback` · `GET /my-meetings` · `GET /my-notifications` · `PUT /notifications/:id/read` · `GET /my-tasks` · `PUT /tasks/:id/toggle` · `PUT /tasks/:id/progress` · `POST /tasks/:id/submit` · `GET /tasks/:id/feedback`.

**Academic supervisor** (`/api/supervisor`, role `academic_supervisor`) — `GET /my-interns` · `GET|POST /meetings` · `PUT|DELETE /meetings/:id` · `PUT /meetings/:id/initiate` · `GET /notifications` · `PUT /notifications/:id/read` · `GET /reports` · `PUT /reports/:id/feedback` · `GET|POST /interns/:studentId/grade` · `GET|POST /tasks` · `PUT|DELETE /tasks/:id` · `PUT /tasks/:id/feedback`.

**Professional supervisor** (`/api/professional-supervisor`, role `professional_supervisor`) — `GET /my-interns` · `GET|POST /tasks` · `PUT|DELETE /tasks/:id` · `PUT /tasks/:id/feedback` · `GET|POST /meetings` · `PUT|DELETE /meetings/:id` · `PUT /meetings/:id/initiate` · `GET|POST /interns/:studentId/grade` · `GET /stats`.

**Legacy meeting API** (`/api/meetings`) — `POST /schedule` · `GET /supervisor` · `PUT|DELETE /:id` · `PUT /:id/initiate` (academic only) · `GET /student` (student). **Duplicates the `/api/supervisor/meetings` surface** with different validation.

**Workspace** (`/api/workspace`) — `GET /reports/:id/workspace` · `PUT /reports/:id/workspace` (student) · `POST /reports/:id/comments` · `DELETE /reports/:id/comments/:commentId` (supervisors).

**Timeline** — `GET /api/timeline` (protected, all roles).

**Admin** (`/api/admin`, role `admin`) — `GET /dashboard` · `GET /chart-data` · `GET|POST /users` · `GET|PUT|DELETE /users/:id` · `POST /users/:id/resend-account-email` · `PUT /users/:id/status` · `PUT /users/:id/reset-password` · `GET /students` · `GET /supervisors` · `GET /internships` · `GET /reports` · `PUT /reports/:id` · `GET|POST /meetings` · `PUT|DELETE /meetings/:id` · `GET|POST /notifications` · `GET|POST|PUT /defense-alerts` · `POST /import/csv` · `GET|POST /timeline` · `PUT|DELETE /timeline/:id`.

### 3.4.3 Documented vs Actual Paths

| v2.0 documented | Actual |
| :--- | :--- |
| `/api/password/forgot-password`, `/verify-otp`, `/reset-password` | `/api/users/forgot-password` (stub); the other two do not exist |
| `/api/student/reports/:id/ai-analysis` | `/api/students/reports/:id/send-to-ai` |
| `/api/student/tasks` | `/api/students/my-tasks` |
| `/api/student/final-grade` | `/api/students/my-final-grade` |
| `/api/supervisor/grade` | `/api/supervisor/interns/:studentId/grade` |
| `/api/supervisor/meetings` | Exists **and** a duplicate `/api/meetings/*` surface |
| `/api/admin/plagiarism/reindex` | Does not exist |

---

## 3.5 Code Organization

### 3.5.1 Server Layout

```
server/
├── config/        db.js (Sequelize + hardcoded credentials) · socket.js (EMPTY)
├── controllers/   13 files (reportController.js EMPTY)
├── middleware/    authMiddleware.js · roleMiddleware.js · uploadMiddleware.js
├── models/        12 files, 10 real models (aiModel.js, supervisorModel.js EMPTY)
├── prompts/       reportReviewPrompt.js
├── routes/        13 files (reportRoutes.js EMPTY and unmounted)
├── services/      geminiService.js (real) · plagiarism/email/schedule/videoService.js ALL EMPTY
├── utils/         extractPdfText.js · aiQuota.js · sendEmail.js · generateJWT.js · generatePassword.js ·
│                  csvParser.js (real but unreferenced) · csvProcessor.js (EMPTY) · textExtractor.js (EMPTY)
├── jobs/          deadlineJob.js (EMPTY)
├── scripts/       admin/supervisor creation, column migrations, orphan check/clean utilities
├── test/          mocha + supertest suite
├── uploads/       uploaded PDFs (served at /uploads)
└── server.js      startup, column migrations, route mounting
```

### 3.5.2 Client Layout

```
client/src/
├── App.jsx            ← live router (role-guarded routes)
├── router/AppRouter.jsx  ← DEAD CODE, never imported
├── pages/             dashboards per role, Login, ForgotPassword, ChangePassword,
│                      WritingWorkspace, AIFeedback, MyReports, MySupervisors, Settings,
│                      admin/* (12 admin screens)
├── components/        ProtectedRoute, Sidebar, ThemeToggle, ai/ReportAIReview,
│                      dashboard/* (cards, modals, timeline, grade card)
├── context/           AuthContext, ThemeContext (RoleContext.jsx EMPTY)
├── api/ axios.js      Axios instance (base URL hardcoded) + interceptors
├── services/          adminService, aiService, api, supervisorService, professionalSupervisorService
├── layouts/           AuthLayout.jsx, DashboardLayout.jsx (BOTH EMPTY)
├── hooks/             useCountUp, useCurrentUser
└── assets/css/        6 stylesheets implementing the design-token system
```

### 3.5.3 Dead Code

**15 source files are 0 bytes**, including four services and two utilities that v2.0 names as working components. Two further files are non-empty but unreferenced (`utils/csvParser.js`, `router/AppRouter.jsx`). The complete register with impact analysis is in `06_IMPLEMENTATION_STATUS_AND_ROADMAP.md` §6.6.
