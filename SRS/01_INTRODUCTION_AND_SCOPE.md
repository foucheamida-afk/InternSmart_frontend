# 01. Introduction and Scope

**Version 2.1.0 — As-Built Edition**

## 1.1 Purpose

This document specifies the functional, non-functional and structural requirements of **InternSmart**, an internship management, report-writing and evaluation platform for higher-education institutions.

InternSmart is the institutional workspace for managing the university internship lifecycle. It connects four roles — **Students**, **Academic Supervisors**, **Professional (Company) Supervisors**, and **System Administrators** — in one application covering internship assignment, task tracking, report drafting and AI-assisted review, supervision, meetings, dual-supervisor grading, and administrative governance.

Version 2.1.0 differs in kind from earlier revisions: every requirement is labelled with its **delivery status** and backed by a code reference, so this suite can be used both as a specification and as an accurate description of the delivered system. See [`06_IMPLEMENTATION_STATUS_AND_ROADMAP.md`](./06_IMPLEMENTATION_STATUS_AND_ROADMAP.md) for the coverage summary.

---

## 1.2 Scope & Objectives

InternSmart addresses the operational gaps in university internship programmes — fragmented communication, manual report review, limited progress visibility, inconsistent workplace feedback, and unverified report integrity — through six operational pillars. Each is listed below with its **as-built status**.

### Pillar 1 — Task Assignment, Progress Tracking & Notification · **Implemented**
Replaces fragmented email threads with in-app task assignment, student progress submission (0–100% with work URLs and notes), per-role supervisor feedback, in-app notifications, and deadline tracking.
*Evidence:* `server/models/taskModel.js`, `server/controllers/supervisorTaskController.js`, `server/controllers/studentController.js`, `server/controllers/professionalSupervisorController.js`.

### Pillar 2 — AI Report Writing Workspace & Error Inspector · **Implemented**
Students upload a PDF report; the server extracts its text and stores it on the report record. A writing workspace built on a rich-text editor allows drafting, and Google Gemini is invoked to produce structured review feedback (scores by academic criterion plus issue cards with severity, location and suggested corrections), subject to a per-student daily quota.
*Evidence:* `server/controllers/aiController.js`, `server/controllers/reportWorkspaceController.js`, `server/services/geminiService.js`, `server/prompts/reportReviewPrompt.js`, `server/utils/aiQuota.js`, `client/src/pages/WritingWorkspace.jsx`.
> **Note:** v2.0 described this workspace as a read-only split-screen text view. The delivered workspace is an editable rich-text editor with optional real-time collaboration (Tiptap / Yjs). See `03_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md` §3.2.1.

### Pillar 3 — Internal Academic Plagiarism Detection Engine · **Missing (Roadmap)**
v2.0 specified an automated similarity engine comparing new report drafts against an internal repository of prior student reports, with n-gram fingerprinting, TF-IDF/cosine comparison, a Similarity Index with severity thresholds (Clean < 15 %, Warning 15–25 %, Flagged ≥ 25 %), supervisor side-by-side inspection, and a pre-grading safeguard.

**This engine is not implemented.** The only artefact is `server/services/plagiarismService.js`, which is **0 bytes** and imported nowhere. There are no plagiarism models, routes, controllers, algorithms, administrative configuration, or supervisor UI. The full specification is retained in `04_FUNCTIONAL_REQUIREMENTS.md` §4.4 as **roadmap**, not as delivered behaviour.
*Nearest existing capability:* Gemini-based citation and referencing commentary in the AI review prompt, which explicitly instructs the model **not** to assert plagiarism (`server/prompts/reportReviewPrompt.js:33-34`).

### Pillar 4 — Dual-Supervisor Evaluation · **Implemented**
Grading responsibility is split between the Academic Supervisor (academic rigour and report quality out of 20) and the Professional Supervisor (workplace execution out of 10), each submitting a structured JSON rubric breakdown, with a composite final grade view for the student.
*Evidence:* `server/models/studentAssignmentModel.js` (`academicGrade*`, `professionalGrade*`), `server/controllers/supervisorController.js`, `server/controllers/professionalSupervisorController.js`, `client/src/components/dashboard/FinalGradeCard.jsx`.

### Pillar 5 — Meeting Scheduling & Video Conferencing · **Implemented**
Supervisors schedule individual or group check-ins; the backend generates a unique Jitsi WebRTC room link, stores it on the meeting, and notifies participants in-app with a one-click join action.
*Evidence:* `server/models/meetingModel.js`, `server/controllers/meetingController.js`, `server/routes/meetingRoutes.js`, `client/src/components/dashboard/UpcomingMeeting.jsx`.

### Pillar 6 — Administrative Governance & Data Integrity · **Implemented (with caveats)**
Administrators manage users, students, supervisors and internships; onboard student cohorts by CSV; configure internship timeline phases; publish defence alerts; and delete users through a programmatic cascading cleanup routine.
*Evidence:* `server/controllers/adminController.js`, `server/controllers/timelineController.js`, `server/utils/csvParser.js`, `server/scripts/checkOrphans.js`, `server/scripts/cleanOrphans.js`.
> **Caveats:** the cascading cleanup is programmatic and does not cover tables that do not exist (the plagiarism tables); the zero-orphan guarantee is therefore partial by construction. Additionally, several defence-alert capabilities are admin-facing only. See `04_FUNCTIONAL_REQUIREMENTS.md` §4.10 and §4.11.

---

## 1.3 Target Audience

- **Software Engineers & Maintainers** — implementing and extending REST services, Sequelize models, React components, and third-party integrations.
- **Academic Supervisors & Faculty Leads** — understanding review, grading and supervision workflows.
- **System Administrators & IT Operations** — account provisioning, CSV onboarding, timeline and defence-alert configuration, database integrity.
- **Quality Assurance & Testing** — deriving test cases from requirement IDs and validating access-control boundaries.
- **Project Stakeholders** — using §06 to distinguish delivered functionality from planned scope.

---

## 1.4 Definitions, Acronyms, and Abbreviations

| Term / Acronym | Definition |
| :--- | :--- |
| **SRS** | Software Requirements Specification |
| **JWT** | JSON Web Token — signed token carrying user identity and role, transmitted as `Authorization: Bearer <token>` |
| **ORM** | Object-Relational Mapping — Sequelize, mapping relational tables to JavaScript models |
| **API** | Application Programming Interface |
| **AI Review** | Google Gemini report evaluation producing criterion scores and structured issue feedback |
| **Jitsi Meet** | WebRTC video-conferencing platform used for virtual check-ins |
| **CSV** | Comma-Separated Values — format used for administrative bulk student onboarding |
| **Similarity Index (SI)** | *(Roadmap)* Percentage of submitted text matching repository documents |
| **N-Gram** | *(Roadmap)* Contiguous sequence of *n* tokens used for similarity fingerprinting |
| **TF-IDF / Cosine Similarity** | *(Roadmap)* Statistical text-comparison metrics |
| **Corpus** | The set of stored student reports used as a comparison baseline |
| **Rich-text workspace** | The Tiptap-based collaborative editor used for report drafting |
| **Yjs / Hocuspocus** | CRDT and WebSocket provider powering optional real-time collaborative editing |
| **Soft-delete / cascading delete** | Programmatic removal of a user and their dependent records across related tables |

> Terms marked *(Roadmap)* belong to the unimplemented plagiarism engine and are retained for continuity with v2.0.

---

## 1.5 Project Overview & Technical Foundation *(as built)*

InternSmart is a decoupled client-server web application.

- **Client tier:** React **19.2.8** single-page application built with **Vite 8**, routed by **react-router-dom 7**, styled with **Tailwind CSS 4** plus a custom CSS design-token system (glassmorphism, dark mode), using **Axios** for HTTP with JWT header injection. The writing workspace adds **Tiptap 3** with **Yjs**/**Hocuspocus** for collaborative editing.
- **Application tier:** **Node.js** with native ES Modules (`"type": "module"`) running **Express 5.2.1**, with modular routers, JWT authentication middleware and role guards (the `protect` / `authorize` pattern), and **Multer 2** for uploads.
- **Data tier:** Relational SQL via **Sequelize**, using **mysql2** or **pg** drivers. Ten persisted entities: `User`, `Student`, `Internship`, `Report`, `ReportComment`, `Task`, `Meeting`, `Notification`, `DefenseAlert`, `TimelineSetting`. Uploaded artefacts are stored on the local filesystem under `server/uploads/` and served from `/uploads`.
- **Integration tier:** **Google Gemini** (`@google/genai` 2.21) for AI report review, **Jitsi Meet** public rooms for meetings, and **Nodemailer** over SMTP for account and notification email.

> v2.0 described React 18, React Router 6, a `pdf-parse`-based extraction utility, and an `emailService.js` module. The delivered versions and modules differ — see §3.2 of the architecture document for the corrected stack and the drift register in §06.
