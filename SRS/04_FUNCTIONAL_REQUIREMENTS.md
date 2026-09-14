# 04. Functional Requirements

**Version 2.1.0 — As-Built Edition**

Requirement IDs follow the v2.0 numbering for traceability. Two corrections are applied and marked inline:

- **§4.11 IDs:** v2.0's normative text used `FR-ADM-07..09` while its own index used `FR-TIM-01..03`. This edition adopts **`FR-TIM-01..03`** (the section is titled "Timeline & Defense Alert Management (TIM)").
- Statuses reflect a static audit of the repository as of 2026-09-14. Requirements marked **Missing (Roadmap)** are retained as design intent, not as delivered behaviour.

**Coverage: 25 Implemented · 22 Partial · 13 Missing — of 60 requirements.**

---

## 4.1 Authentication & Access Control (AUTH)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-AUTH-01 | Credentials login | **Implemented** | `authController.js:20-50`; `authRoutes.js:9`; `Login.jsx:107-147` |
| FR-AUTH-02 | JWT with id/role/name/email + status check | **Implemented** | `utils/generateJWT.js:5-10`; `authController.js:33-37`; `authMiddleware.js:21-28` |
| FR-AUTH-03 | Persist token + auto-attach Bearer header | **Implemented** | `utils/storage.js:14-24`; `api/axios.js:11-24` |
| FR-AUTH-04 | Password-reset request | **Implemented** | `passwordController.js` → `forgotPassword`; `passwordRoutes.js`; `ForgotPassword.jsx` step 1 |
| FR-AUTH-05 | 6-digit OTP, 15-min expiry, emailed | **Implemented** | `passwordController.js` (`generateOtp` via CSPRNG, `OTP_TTL_MINUTES = 15`); `sendEmail.js` → `sendPasswordResetEmail` |
| FR-AUTH-06 | OTP verification + password reset | **Implemented** | `passwordController.js` → `verifyOtp`, `resetPassword` (bcrypt, single-use token) |
| FR-AUTH-07 | Role guards (router + Express) | **Implemented** | `roleMiddleware.js:1-18`; `ProtectedRoute.jsx:19-33`; `App.jsx:40-133` |
| FR-AUTH-08 | 401 unauthenticated / 403 wrong role | **Implemented** | `authMiddleware.js:8-12,21-26,32-38`; `roleMiddleware.js:4-14`; `api/axios.js:26-43` |

**Deviations**
- **Password endpoints live under `/api/users`**, not `/api/password` as v2.0 specified: `POST /api/users/forgot-password`, `POST /api/users/verify-otp`, `POST /api/users/reset-password`, plus the authenticated `PUT /api/users/change-password`.
- **The full OTP recovery flow is implemented** *(2026-09-14)*. A cryptographically random 6-digit code is emailed, valid for 15 minutes, and exchanged for a short-lived reset token that is single-use. Deviations from v2.0 worth noting: the code is stored only as a **bcrypt hash** in `otpCode` rather than in plaintext, and an added `otpAttempts` counter caps guessing at 5 tries. Verified end-to-end: a wrong code decrements the allowance, an expired code is invalidated, the 6th attempt returns 429, a replayed token is rejected, the new password works while the old one fails, and reset tokens cannot be used as access tokens (or vice versa) because they are signed with a secret derived from `JWT_SECRET`.
- **Account enumeration is prevented**: `/forgot-password` returns an identical 200 response whether or not the address exists, whether or not the account is active, and whether or not delivery succeeds (delivery failures are logged server-side, never surfaced).
- **Account status is `active`** (`userModel.js:43-47`), not `isBlocked` as v2.0 specified. Deactivated accounts receive **403**, not 401.
- **JWT expiry is hardcoded to 1 day** (`generateJWT.js:13`), not environment-driven.
- ~~`authController.js:3` imported `../utils/generatejwt.js` while the file is `generateJWT.js`.~~ **Fixed 2026-09-14** — the import now matches case-exactly, so login works on the SRS-specified case-sensitive Linux host; a repo-wide sweep found no other mismatches.
- Delivery gap: some pages bypass the shared Axios instance using raw `fetch` with a manually attached header (`Login.jsx:107`, `ChangePassword.jsx:111`, `MySupervisors.jsx:49`, `Settings.jsx:45`).
- ~~**Defect:** `ChangePassword.jsx` referenced an undefined `passwordRules`, throwing on render.~~ **Fixed 2026-09-14** — the requirements list is rendered from the single `passwordRequirements` array, so the first-login password screen loads.

---

## 4.2 Student Dashboard & Profile Management (STU)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-STU-01 | Dashboard summary indicators | **Partial** | `studentController.js:697-734`; `StudentDashboard.jsx:401-440`; `TasksCard.jsx:391-394` |
| FR-STU-02 | Profile metadata view | **Implemented** | `studentRoutes.js:47` → `studentController.js:99-132`; `MySupervisors.jsx:215-324` |
| FR-STU-03 | Timeline phases with milestones | **Partial** | `timelineRoutes.js:8` → `timelineController.js:105-118`; `InternshipTimeline.jsx:59-117` |

**Deviations**
- Five of six dashboard indicators exist (progress, AI score, submission status, pending-task count, meetings). **The defence-alert countdown is absent** — `studentController.js` never imports `DefenseAlert`, and no student-facing component reads it.
- Dashboard freshness is 15-second polling, not push (`StudentDashboard.jsx:107`).
- Timeline phases are **free-form administrator-entered strings**; there is no fixed Preparation/Execution/Mid-term/Final Draft/Defence phase set and no seeding. Milestone indicators are binary past/future.

---

## 4.3 AI Report Writing Workspace & Error Inspector (AI)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-AI-01 | PDF draft upload | **Implemented** | `studentRoutes.js:32-43,50` |
| FR-AI-02 | Extract PDF text into `Reports.documentContent` | **Partial** | `utils/extractPdfText.js:8-23`; `studentController.js:181,196,210`; `reportModel.js:71-74` |
| FR-AI-03 | Version increment + status reset | **Implemented** | `studentController.js:186-197` |
| FR-AI-04 | Trigger AI review | **Partial** | `studentRoutes.js:53`; `aiRoutes.js:9-24` |
| FR-AI-05 | Daily AI quota enforcement | **Partial** | `utils/aiQuota.js:3-20`; `studentController.js:312` |
| FR-AI-06 | Criterion-based AI evaluation scores | **Partial** | `prompts/reportReviewPrompt.js:240-248`; `studentController.js:339-345,374-375` |
| FR-AI-07 | Structured issue output (severity, snippets, fixes) | **Implemented** | `reportReviewPrompt.js:223-281`; `studentController.js:348-387` |
| FR-AI-08 | Writing workspace: text alongside review cards | **Partial** | `WritingWorkspace.jsx:1193-1204,1383-1411`; `AIFeedback.jsx:839-1010` |
| FR-AI-09 | Click-to-highlight + copy suggested fix | **Partial** | Copy: `AIFeedback.jsx:983-989`; `WritingWorkspace.jsx:1659-1669`. Highlight: absent |

**Deviations**
- **Real endpoints differ.** Working trigger is `POST /api/students/reports/:id/send-to-ai`; there is no `/api/student/reports/:id/ai-analysis`. Additional paths: `POST /api/ai/review`, `POST /api/ai/review-report` (returns JSON, persists nothing, caller commented out), `POST /api/ai/writing-assistant`, `GET /api/ai/writing-assistant/quota`.
- **Quota is 5 per UTC calendar day, not 3**, shared between report review and the writing assistant, stored on the `Student` row (`aiRequestsToday`, `aiRequestsDate`). **Fixed 2026-09-14:** PDF text extraction now happens *before* the quota is charged, so an unreadable PDF costs nothing, and any AI failure restores the report's prior status/progress and refunds the request — verified with a deliberately invalid API key (report returned to `submitted`/0, quota charged to 2 then refunded to 1).
- **`documentContent` is a structured editor document (ProseMirror/TipTap JSON) in a `JSON` column**, not plain text in `LONGTEXT`. AI review re-extracts text from the stored PDF on disk instead of using this column.
- **Model:** primary default is a non-2.5 model with an automatic fallback model, up to 3 retries with backoff, and prompt truncation at ~120 000 characters (`geminiService.js:34-90`).
- Criterion naming differs: the prompt returns **five 0-100 scores** (including an overall score later divided by 10 for display); the frontend surfaces five metrics in which language/grammar is duplicated.
- `FR-AI-08`: there is **no true report-text-alongside-cards split view**. The workspace pairs the editor with an assistant/chat sidebar; the modal pairs chat with issue cards and includes **hardcoded** card content (`WritingWorkspace.jsx:1383-1411`), and `AIFeedback.jsx:729-757` falls back to hardcoded demo issues.
- `FR-AI-09`: one-click copy works; **click-to-highlight is non-functional** — `expandedErrorId` / `expandedWorkspaceErrorId` are dead state never set or read, and no card targets the editor.
- **Broken call:** the workspace chat posts to `/ai/reports/:id/ask-assistant`, which does not exist, and silently falls back to a canned string (`WritingWorkspace.jsx:1331,1334,1559,1562`).

---

## 4.4 Internal Academic Plagiarism Detection Engine (PLAG)

> **This module is entirely unimplemented.** The only artefact in the repository is `server/services/plagiarismService.js`, which is **0 bytes** and imported nowhere. There are no models, tables, routes, controllers, algorithms, administrative configuration, or supervisor UI. The nearest existing behaviour is citation/referencing commentary from the AI review, whose prompt positively instructs the model **not** to assert plagiarism (`prompts/reportReviewPrompt.js:33-34`).
>
> The specification below is retained as **roadmap**.

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-PLAG-01 | Auto-scan on submission / version bump | **Missing (Roadmap)** | `studentController.js:186-211` returns with no scan call |
| FR-PLAG-02 | Compare against institutional repository baseline | **Missing (Roadmap)** | No corpus query anywhere |
| FR-PLAG-03 | Multi-stage detection pipeline | **Missing (Roadmap)** | `services/plagiarismService.js` = 0 bytes |
| FR-PLAG-04 | Similarity Index + severity thresholds | **Missing (Roadmap)** | No `clean`/`warning`/`flagged` enum, no 15 %/25 % constants |
| FR-PLAG-05 | Match attribution logging | **Missing (Roadmap)** | No `PlagiarismMatch` model or offset columns |
| FR-PLAG-06 | Side-by-side inspection modal | **Missing (Roadmap)** | No client component or request |
| FR-PLAG-07 | Split-screen highlighted comparison | **Missing (Roadmap)** | Absent |
| FR-PLAG-08 | Matched-source attribution details | **Missing (Roadmap)** | Absent |
| FR-PLAG-09 | Pre-grading safeguard + override note | **Missing (Roadmap)** | `supervisorController.js:557-617` has no integrity check |
| FR-PLAG-10 | Student visibility toggle | **Missing (Roadmap)** | No institutional-settings entity or endpoint |
| FR-PLAG-11 | Admin thresholds + corpus re-index | **Missing (Roadmap)** | No `/api/admin/plagiarism/*`; no thresholds in `.env` |

**Notes for roadmap planning**
- The submission/version-increment path (`studentController.js:186-211`) is the natural hook point and already exists.
- `NFR-MNT-03` designates `plagiarismService.js` as the intended modular seam; the empty file preserves that location.
- The engine's input would need normalisation first, because `documentContent` is structured JSON rather than flat text.
- **Schema consequence:** `FR-PLAG-05` and the cascade requirements (`FR-ADM-05`, `NFR-REL-02`) cannot be fully satisfied until `PlagiarismScan`, `PlagiarismMatch` and `DocumentFingerprint` exist.

---

## 4.5 Academic Supervisor Module (SUP)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-SUP-01 | Assigned intern list with progress/AI/plagiarism state | **Partial** | `supervisorRoutes.js:22` → `supervisorController.js:39-56`; `SupervisorDashboard.jsx:687-712` |
| FR-SUP-02 | Report review, comments, AI breakdown | **Partial** | PDF `SupervisorDashboard.jsx:1051`; comments `reportWorkspaceController.js:137-152`; AI data `supervisorController.js:444-450` |
| FR-SUP-03 | Report status transitions | **Partial** | `supervisorController.js:500-504`; `reportModel.js:28-38` |
| FR-SUP-04 | Academic grade out of 20 | **Partial** | `supervisorRoutes.js:41`; `supervisorController.js:576-591`; `SupervisorDashboard.jsx:32-38` |

**Deviations**
- `FR-SUP-01` payload carries identity, matricule, class, company and report id only — **no progress %, no AI score, no plagiarism flag**.
- `FR-SUP-02`: comments are accepted through the **workspace** routes (`/api/workspace/reports/:id/comments`), not a supervisor route. The AI breakdown is returned by `GET /api/supervisor/reports` but is **never rendered** in the supervisor UI. The **Plagiarism Inspector does not exist**.
- `FR-SUP-03`: the API passes the submitted status straight to the model, relying on the DB ENUM for validation; the supervisor UI only ever sends `in_review` — `approved`/`needs_revision` are reachable only from the admin portal.
- `FR-SUP-04`: the **SRS path `/api/supervisor/grade` does not exist**; the real path is `/api/supervisor/interns/:studentId/grade`. **Fixed 2026-09-14:** the server now rescales the submitted rubric onto the institutional 20-point scale and caps the total server-side — previously it stored an unbounded raw sum of whichever maxima the browser sent, so "out of 20" existed only as a client-side default. The delivered rubric criteria still differ from the SRS text.
- The supervisor report PDF link is **hardcoded to `http://localhost:3000`** (`SupervisorDashboard.jsx:1051`), breaking outside local development.

---

## 4.6 Professional Supervisor Module (PSUP)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-PSUP-01 | Company intern directory | **Implemented** | `professionalSupervisorRoutes.js:24`; `professionalSupervisorController.js:11-55` |
| FR-PSUP-02 | Work task assignment | **Partial** | `professionalSupervisorController.js:128-159`; `taskModel.js:4-89` |
| FR-PSUP-03 | Task submission review | **Implemented** | `professionalSupervisorController.js:58-125,191-280`; `InspectSubmissionModal.jsx:94-147` |
| FR-PSUP-04 | Workplace grade out of 10 | **Implemented** | `professionalSupervisorRoutes.js:42`; `professionalSupervisorController.js:642-660` |

**Deviations**
- `FR-PSUP-02`: title, description and due date are supported, but **no priority field exists** anywhere in the task schema or UI.
- `FR-PSUP-04` is the stronger of the two grading implementations: the server rescales any submitted rubric so its maximum is 10 and caps the total, so the 10-point contract genuinely holds.

---

## 4.7 Meeting Management & WebRTC Video Conferencing (MTG)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-MTG-01 | Individual + group meeting scheduling | **Implemented** | `supervisorRoutes.js:25-29`; `professionalSupervisorRoutes.js:34-38`; `supervisorController.js:131-167` |
| FR-MTG-02 | Meeting payload validation | **Partial** | `supervisorController.js:133-139`; `meetingController.js:23-34` |
| FR-MTG-03 | Jitsi room URL generation | **Implemented** | `supervisorController.js:9-15,152-154`; `meetingController.js:8-14,47-49` |
| FR-MTG-04 | Initiate meeting + notify participants | **Partial** | `supervisorController.js:292-321`; `meetingController.js:180-206`; `meetingModel.js:30-34` |
| FR-MTG-05 | One-click student launch | **Implemented** | `StudentDashboard.jsx:264-276,358-367`; `UpcomingMeeting.jsx:89-94` |

**Deviations**
- `FR-MTG-02`: title, date and at least one participant are required, but **description is optional** (defaults to empty). Past-date rejection exists only on `/api/meetings/schedule` and the professional-supervisor route — **not** on `/api/supervisor/meetings`.
- `FR-MTG-03`: the room slug is derived from the meeting title plus an id and timestamp, e.g. `https://meet.jit.si/<slug>`. The SRS's `internsmart-<hash>` form is not used and **no cryptographic hash is applied**, so room names are guessable and not access-controlled.
- `FR-MTG-04`: notification rows **are** created for individual and all group participants, carrying the join link. However, **"Initiate" never sets the meeting to an active state** — it writes `status: "scheduled"`, and the `Meeting` status enum allows only `scheduled`/`completed`/`cancelled`, so no active state exists to set.
- **No real-time delivery.** `socket.io` and `socket.io-client` are declared dependencies, but `server/config/socket.js` is 0 bytes, `server.js` never creates a socket server, and no emit call exists. Students poll (meetings every 10 s; notifications once per mount), so a "Join Now" notification appears only after a poll or refresh.
- **Group meetings are invisible in student meeting lists** — both student meeting queries filter on `studentId = student.id`, while group meetings store `studentId = null` with a `studentIds` array. Group participants are reachable only via the notification button.
- **Duplicate implementations:** the academic meeting API exists twice — `/api/supervisor/meetings*` and `/api/meetings/*` — with divergent validation and separate controllers.

---

## 4.8 Task Management & Progress Tracking (TSK)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-TSK-01 | Student task board | **Partial** | `studentRoutes.js:59` → `studentController.js:509-530`; `TasksCard.jsx:353` |
| FR-TSK-02 | Progress 0-100 % + work URL + note | **Implemented** | `studentRoutes.js:61-62`; `studentController.js:583-590,618-625`; `TasksCard.jsx:180-240` |
| FR-TSK-03 | Notify assigning supervisor | **Implemented** | `studentController.js:627-646` |
| FR-TSK-04 | Task review drawer | **Partial** | `InspectSubmissionModal.jsx:4-151`; `SupervisorDashboard.jsx:1413-1417` |

**Deviations**
- `FR-TSK-01`: the SRS path `/api/student/tasks` does not exist — the collection is `GET /api/students/my-tasks`. Due dates, status and feedback are shown; **priority tags are absent** (no priority column).
- `FR-TSK-02` is solid: progress is clamped 0–100 server-side and task status is derived from it.
- `FR-TSK-03`: the explicit submit action notifies the assigning supervisor **and** the internship's academic and professional supervisors. **Progress-only updates do not notify.**
- `FR-TSK-04`: the drawer reviews the submission, requests revision and approves, but **cannot adjust the progress percentage** — progress requires the separate inline edit form.

---

## 4.9 Dual-Supervisor Evaluation & Grading System (GRD)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-GRD-01 | Dual grade weighting (20 + 10) | **Implemented** | `utils/gradeCalculator.js`; `supervisorController.js` → `submitFinalGrade`; `professionalSupervisorController.js` → `submitFinalGrade` |
| FR-GRD-02 | Structured rubric JSON with feedback | **Implemented** | both submit handlers persist `label`/`score`/`max`/**`feedback`** |
| FR-GRD-03 | Student grade breakdown view | **Implemented** | `studentController.js` → `getMyFinalGrade` (`final` + `finalized`); `FinalGradeCard.jsx` |

**Deviations (updated 2026-09-14)**
- **The composite final grade is now computed.** Each submission rescales its rubric onto the institutional scale (academic `/20`, professional `/10`), and every submission recomputes a weighted composite — **academic ⅔, professional ⅓**, mirroring the 20:10 point split — projected back onto a **0–20** final mark, so a perfect 20 + 10 yields 20/20. The previous behaviour was worse than v2.0 implied: the academic total was an **unbounded raw sum** of whichever maxima the browser sent, and nothing anywhere combined the two.
- `FR-GRD-02`: rubric breakdowns persist `label`/`score`/`max` **and now `feedback`**, which both mappers previously dropped before the data reached the database.
- `FR-GRD-03`: `GET /api/students/my-final-grade` returns `final` (score, max, percentage, weights and per-component percentages) plus a **`finalized` flag that is true only once BOTH evaluations have been submitted**; `final.score` is `null` until then, so a partial total is never presented as the final grade. `FinalGradeCard.jsx` renders the combined mark, or a "pending — n of 2 evaluations submitted" indicator.
- **Schema reuse resolved:** the previously unused legacy columns (`finalGrade`, `gradeBreakdown`, `gradeStatus`, `gradeSubmittedAt`) are now the storage location for the composite, so there is a single combined mark rather than a third parallel field.

---

## 4.10 Administrator Dashboard & Cascading User Cleanup (ADM)

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-ADM-01 | Full entity CRUD + block/unblock | **Partial** | `adminRoutes.js:75-101`; `adminController.js:366-398` |
| FR-ADM-02 | Auto-generated credentials emailed | **Partial** | `adminController.js:692-694,714-719`; `utils/sendEmail.js:32-79` |
| FR-ADM-03 | CSV upload endpoint | **Implemented** | `adminRoutes.js:113,58-68`; `adminController.js:430-436` |
| FR-ADM-04 | CSV validation and onboarding | **Partial** | `adminController.js:445-463,481-491,592-645`; `AdminStudents.jsx:50-60` |
| FR-ADM-05 | Cascading cleanup execution | **Partial** | `adminController.js:299-363` |
| FR-ADM-06 | Zero-orphan integrity guarantee | **Missing (Roadmap)** | `adminController.js:356-362`; `association.js` (no `onDelete`) |
| FR-ADM-07 | Timeline phase management | **Implemented** | `timelineController.js:39-102`; `adminRoutes.js:116-119` |
| FR-ADM-08 | Defence alert scheduling | **Partial** | `adminController.js:1247-1301`; `defenseAlertModel.js:4-31` |
| FR-ADM-09 | Student defence banner + countdown (see `FR-TIM-03`) | **Duplicate ID — see §4.11** | — |

**Deviations**
- `FR-ADM-01`: Users support list/read/create/update/status/delete. **Students and Supervisors have read-only collection endpoints**, and **Internships expose only `GET`** — no create/update/delete routes exist for them. Block/unblock toggles `active`.
- `FR-ADM-02`: `sendAccountEmail` genuinely sends mail, but the temporary password is built with `Math.random()` inline; the crypto-based `generatePassword.js` utility is imported and **never called** (`adminController.js:692,746,504,552,589`).
- `FR-ADM-04`: the required CSV headers are **nine snake_case columns** (including supervisor name/email pairs and company), **not** `Name, Email, Matricule, Class`. The importer also auto-creates supervisor accounts, which the SRS does not describe. **Fixed 2026-09-14:** each row now imports inside its own transaction, so a failing row leaves nothing behind. The two "already assigned to supervisor" checks that previously sat *after* `Student.create` were unreachable dead code — they queried `Internship` by the id of a `Student` row created microseconds earlier — and their `continue` abandoned the freshly created `User`+`Student`; they were removed. `utils/csvProcessor.js` is 0 bytes; the working parser is `utils/csvParser.js`, which nothing imports.
- `FR-ADM-05`: **Fixed 2026-09-14** — the cleanup now runs in a single transaction, so a mid-sequence failure rolls back instead of leaving partial state; it nulls the previously dangling `Task.feedbackAcademicBy`, `Task.feedbackProfessionalBy`, `Internship.academicGradeSubmittedBy` and `Internship.professionalGradeSubmittedBy` references; and group-meeting pruning now actually works (it previously called `Array.isArray()` on a column MariaDB returns as a *string*, so it never pruned anything). Verified on a scratch database: deleting a student cleared all eight dependent tables with zero orphans.
- `FR-ADM-06`: the zero-orphan guarantee is met **in application code**, verified by test. **Correction (2026-09-14):** the earlier claim that no database-level foreign keys exist was wrong — Sequelize infers `references` from associations, so `sync()` creates **13 FK constraints** on a fresh schema. **The live database, however, has only 7**, because `sync({ force: false })` does not alter pre-existing tables; `internships→students`, `internships→users` (both), `meetings→students` and `tasks→users` are unenforced there. Note that `reports→students` is `SET NULL`, so a database-level student delete would *orphan* reports rather than remove them — reinforcing why the programmatic routine is necessary. The three SRS-named plagiarism tables cannot be cleaned because they do not exist. The manual scripts (`scripts/checkOrphans.js`, `scripts/cleanOrphans.js`) remain out-of-band, invoked by no route and not at startup.
- `FR-ADM-08`: the model has **no `location` and no `juryMembers`** fields (v2.0 marks both Not Null), and the status enum is `pending`/`scheduled`/`completed`/`cancelled` rather than `scheduled`/`completed`/`postponed`. There is no delete endpoint; the UI simulates cancellation by setting status.

---

## 4.11 Timeline & Defense Alert Management (TIM)

> **ID correction:** v2.0 numbered these `FR-ADM-07..09` (colliding with §4.10) while its own index used `FR-TIM-01..03`. This edition adopts `FR-TIM-01..03`.

| Req ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| FR-TIM-01 | Timeline phase management (`FR-ADM-07`) | **Implemented** | `timelineController.js:39-102`; `adminRoutes.js:116-119` |
| FR-TIM-02 | Defence alert publishing (`FR-ADM-08`) | **Partial** | `adminController.js:1247-1301`; `AdminDefenseAlerts.jsx:213-256` |
| FR-TIM-03 | Student defence banner + countdown (`FR-ADM-09`) | **Missing (Roadmap)** | No student endpoint or component |

**Deviations**
- `FR-TIM-01` manages free-form timeline phases with a milestones JSON array; there is no fixed five-phase model and no default seeding.
- `FR-TIM-02` creates the alert plus a notification and an email, but as noted in §4.10 it carries no classroom location and no jury members, and has no delete endpoint.
- `FR-TIM-03` is absent: no student-facing endpoint exposes defence alerts and no banner or countdown component exists. Defence alerts are admin-only in practice.
