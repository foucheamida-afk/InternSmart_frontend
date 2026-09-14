# 04. Functional Requirements

## 4.1 Authentication & Access Control (AUTH)

### 4.1.1 User Authentication & Session Management
- **FR-AUTH-01 (Credentials Login):** System shall allow users to log in securely using their registered email address and password.
- **FR-AUTH-02 (JWT Generation):** Backend shall verify user credentials against `users` database table, verify account status (`isBlocked === false`), and return a signed JSON Web Token (JWT) containing user ID, role, name, and email.
- **FR-AUTH-03 (Token Interceptor):** Frontend shall persist JWT in secure local storage and automatically attach `Authorization: Bearer <token>` header to all outgoing Axios HTTP requests.

### 4.1.2 Password Recovery & OTP Verification
- **FR-AUTH-04 (Password Reset Request):** Users shall be able to request a password reset via `/api/password/forgot-password` by specifying their registered email.
- **FR-AUTH-05 (OTP Dispatch):** System shall generate a cryptographically random 6-digit temporal numeric OTP code with a 15-minute expiration timestamp and dispatch it to the user's email address via SMTP Nodemailer engine.
- **FR-AUTH-06 (OTP Verification & Password Update):** Users shall submit the received OTP to `/api/password/verify-otp`. Upon verification, the user can reset their password via `/api/password/reset-password` (hashed using `bcrypt`).

### 4.1.3 Authorization Guards & Middleware Protection
- **FR-AUTH-07 (Role Guards):** Frontend router (`AppRouter.jsx` / `ProtectedRoute.jsx`) and Express backend middleware (`protect`, `authorize("role")`) shall strictly enforce endpoint access by user role.
- **FR-AUTH-08 (Unauthorized Interception):** Unauthenticated requests shall be rejected with HTTP status code `401 Unauthorized`, and unauthorized role privilege attempts shall yield HTTP `403 Forbidden`.

---

## 4.2 Student Dashboard & Profile Management (STU)

- **FR-STU-01 (Dashboard Summary):** Student dashboard shall render real-time summary indicators: overall internship progress (0-100%), active AI report evaluation score, submission status, pending tasks count, scheduled meetings, and defense alert countdowns.
- **FR-STU-02 (Student Profile Information):** Students shall be able to view their assigned profile metadata (`matricule`, `class`, assigned Academic Supervisor, assigned Professional Supervisor, host company name).
- **FR-STU-03 (Timeline Progress View):** Students shall be able to view institutional internship timeline phases (Preparation, Execution, Mid-term Check, Final Draft, Defense) with active milestone indicators.

---

## 4.3 AI Report Writing Workspace & Error Inspector (AI)

### 4.3.1 PDF Upload & Document Parsing
- **FR-AI-01 (Document Submission):** Students shall upload report drafts in binary PDF format.
- **FR-AI-02 (PDF Text Extraction):** Backend file middleware (`multer`) and parsing utility (`extractPdfText` / `pdf-parse`) shall extract plain text content from the PDF payload and store parsed text into `reports.documentContent`.
- **FR-AI-03 (Version Increment):** Submitting a new report draft for an existing internship increments report version (`version + 1`) and resets review status to `submitted`.

### 4.3.2 Automated Gemini AI Review
- **FR-AI-04 (Trigger AI Review):** Students can execute automated AI report evaluation via endpoint `/api/student/reports/:id/ai-analysis`.
- **FR-AI-05 (Daily Quota Enforcement):** System shall strictly enforce a daily quota cap of 3 AI analysis executions per student per 24-hour cycle to prevent API exhaustion.
- **FR-AI-06 (AI Evaluation Criteria):** Google Gemini 2.5 API prompt engine (`reportReviewPrompt.js`) shall evaluate extracted text against four standardized academic criteria:
  - Structure & Formatting Score (0 - 100)
  - Language, Clarity & Grammar Score (0 - 100)
  - Academic & Technical Depth Score (0 - 100)
  - Citations & Requirements Compliance Score (0 - 100)
  - Overall AI Quality Score (0 - 10)
- **FR-AI-07 (Structured Error Inspector Output):** Gemini API shall return a JSON payload containing specific issues categorized by severity (`High`, `Medium`, `Low`), original document snippets, section locations, explanations, suggested corrections, and highlighted document strengths.

### 4.3.3 Interactive Writing Workspace UI
- **FR-AI-08 (Writing Workspace Modal):** Frontend UI (`WritingWorkspace.jsx` & `ReportAIReview.jsx`) shall provide a split-screen view allowing students to view report text alongside interactive AI review cards.
- **FR-AI-09 (Error Navigation & Copy Fix):** Clicking an issue card shall highlight the target section in text preview and offer single-click copy capability for suggested corrections.

---

## 4.4 Internal Academic Plagiarism Detection Engine (PLAG)

### 4.4.1 Automated Plagiarism Check Triggering
- **FR-PLAG-01 (Automated Scan Execution):** System shall automatically trigger an internal plagiarism scan (`PlagiarismScan`) upon initial PDF report submission or version increment (`version + 1`).
- **FR-PLAG-02 (Institutional Repository Baseline):** The Plagiarism Engine shall compare the extracted report text (`documentContent`) against all historical and active student reports stored in the institutional database repository.

### 4.4.2 Detection Engine & Text Tokenization Pipeline
- **FR-PLAG-03 (Multi-Stage Detection Pipeline):**
  1. **Preprocessing & Filtering:** Strips cover page headers, standard institutional templates, running titles, and bibliographic reference sections.
  2. **Fingerprint Generation:** Tokenizes clean text into $k$-gram sequences ($k = 7$), generating hash signatures stored in `DocumentFingerprint` table for O(1) indexed lookup.
  3. **Candidate Matching:** Uses MinHash / Jaccard similarity indexing to identify candidate document matches exceeding 5% overlap.
  4. **Cosine Similarity Vectorization:** Computes TF-IDF vector cosine angle between the target report and top candidate documents to establish precise structural similarity percentages.
  5. **Semantic Paraphrase Spotter:** Optionally invokes Gemini AI to flag rephrased passages that match structural arguments of existing repository reports.

### 4.4.3 Similarity Indexing & Severity Thresholding
- **FR-PLAG-04 (Similarity Score Calculation):** System computes an overall **Similarity Index (SI)** (0.0% to 100.0%) and assigns a status severity:
  - **Clean (`clean`):** SI < 15.0% — Normal academic citation overlap.
  - **Warning (`warning`):** 15.0% $\le$ SI < 25.0% — Moderate textual overlap requiring supervisor inspection.
  - **Flagged (`flagged`):** SI $\ge$ 25.0% — High risk plagiarism flag triggering automatic supervisor warning alerts.
- **FR-PLAG-05 (Match Attribution Logging):** For every detected match, system persists `PlagiarismMatch` records logging matched report ID, source student matricule, source student name, submission year, exact matched text snippet, source text snippet, and start/end character offsets.

### 4.4.4 Academic Supervisor Plagiarism Inspection Modal
- **FR-PLAG-06 (Side-by-Side Comparison Inspector):** Academic Supervisors shall have access to an interactive **Plagiarism Inspector Modal** in the supervisor portal.
- **FR-PLAG-07 (Matched Snippet Highlighting):** The modal shall render a split-screen comparative view displaying the student's report text on the left and the matched repository document on the right, highlighting identical/paraphrased passages with color-coded severity indicators.
- **FR-PLAG-08 (Source Attribution Details):** Clicking a highlighted snippet displays matched source metadata (Original Report Title, Author Matricule, Submission Date, Matching % for section).

### 4.4.5 Grading Enforcement & Overrides
- **FR-PLAG-09 (Pre-Grading Safeguard):** System shall prevent an Academic Supervisor from submitting final academic grades for a report marked `flagged` (SI $\ge$ 25%) unless the supervisor provides an explicit **Academic Override Justification Note** certifying compliance.
- **FR-PLAG-10 (Student Visibility Toggle):** Institutional settings shall allow administrators to toggle whether students view summary plagiarism scores or full matched snippet breakdowns prior to final supervisor grading.
- **FR-PLAG-11 (Admin Engine Configuration & Corpus Re-Indexing):** Admins shall be able to configure global similarity thresholds (15%, 25%), update excluded header phrase lists, and execute full database corpus re-indexing routines (`/api/admin/plagiarism/reindex`).

---

## 4.5 Academic Supervisor Module (SUP)

- **FR-SUP-01 (Assigned Intern List):** Academic Supervisors shall view a dedicated list of assigned student interns (`/api/supervisor/my-interns`) with progress status, report submission state, AI evaluation scores, and plagiarism similarity flags.
- **FR-SUP-02 (Report Review & Comments):** Supervisors can inspect submitted report PDFs, read AI evaluation breakdown, open the Plagiarism Inspector, and append line-item or general review comments (`ReportComment`).
- **FR-SUP-03 (Report Status Transition):** Supervisors can update report status to `in_review`, `approved`, or `needs_revision`.
- **FR-SUP-04 (Academic Evaluation Grading):** Academic Supervisors shall submit formal academic evaluation grades out of 20 points based on institutional rubrics (Report Quality, Methodology, Oral Defense prep) via `/api/supervisor/grade`.

---

## 4.6 Professional Supervisor Module (PSUP)

- **FR-PSUP-01 (Company Intern Directory):** Professional Supervisors shall view company interns assigned to their organization (`/api/professional-supervisor/my-interns`).
- **FR-PSUP-02 (Work Task Assignment):** Professional Supervisors can assign workplace tasks specifying task title, detailed description, target due date, and priority level.
- **FR-PSUP-03 (Task Submission Review):** Supervisors can inspect student task progress, review submitted work URLs and completion notes, and issue status decisions (`completed`, `needs_revision`).
- **FR-PSUP-04 (Workplace Evaluation Grading):** Professional Supervisors shall submit workplace performance grades out of 10 points based on technical execution, work ethics, team collaboration, and punctuality rubrics.

---

## 4.7 Meeting Management & WebRTC Video Conferencing (MTG)

- **FR-MTG-01 (Meeting Scheduling):** Academic and Professional Supervisors can schedule individual or group video check-ins (`/api/supervisor/meetings`, `/api/professional-supervisor/meetings`).
- **FR-MTG-02 (Meeting Payload Validation):** System requires meeting title, description, scheduled date/time, and selection of target student intern(s).
- **FR-MTG-03 (Jitsi Room Generation):** Backend automatically generates a secure, unique WebRTC Jitsi Meet conference room URL (`https://meet.jit.si/internsmart-<hash>`).
- **FR-MTG-04 (Initiate Meeting Notification):** When a supervisor clicks **Initiate Meeting** ("Join Now"), meeting status updates to active, and system dispatches an instant in-app `Notification` record to all designated student participants.
- **FR-MTG-05 (One-Click Student Launch):** Student notifications display a prominent **Join Now** action button opening the WebRTC Jitsi room directly in a new browser tab.

---

## 4.8 Task Management & Progress Tracking (TSK)

- **FR-TSK-01 (Student Task Board):** Students can view all assigned tasks with due dates, priority tags, supervisor feedback, and completion status (`/api/student/tasks`).
- **FR-TSK-02 (Task Progress Submission):** Students can update progress completion percentage (0% to 100%), attach work submission URLs (e.g. GitHub repo, Google Doc), and submit progress notes.
- **FR-TSK-03 (Supervisor Notification):** Submitting a task progress update automatically notifies the assigning supervisor.
- **FR-TSK-04 (Task Review Drawer):** Supervisors can open the **Inspect Submission Drawer**, review work assets, adjust progress percentage, or request revision.

---

## 4.9 Dual-Supervisor Evaluation & Grading System (GRD)

- **FR-GRD-01 (Dual Grade Weighting):** System enforces institutional dual-grading calculation combining Academic Supervisor grade (max 20 points) and Professional Supervisor grade (max 10 points) into a normalized composite final score.
- **FR-GRD-02 (Structured Rubric JSON):** Both supervisor roles submit structured JSON rubrics containing criteria labels, awarded scores, max points, and feedback comments.
- **FR-GRD-03 (Student Grade Breakdown View):** Students can access their final grade card (`/api/student/final-grade`) once both evaluations are submitted and finalized.

---

## 4.10 Administrator Dashboard & Cascading User Cleanup (ADM)

### 4.10.1 User & Entity Lifecycle Management
- **FR-ADM-01 (Full Entity CRUD):** Administrators possess complete privileges to list, view, create, update, block/unblock, and delete Users, Students, Supervisors, and Internships.
- **FR-ADM-02 (Automated Credential Emailing):** Creating a user account automatically generates a secure temporary password (`generatePassword.js`) and emails access credentials via SMTP.

### 4.10.2 Bulk CSV Import Engine
- **FR-ADM-03 (CSV File Upload):** Admins can upload bulk student rosters via CSV (`/api/admin/import/csv`).
- **FR-ADM-04 (Validation & Onboarding):** CSV processor (`csvProcessor.js` / `csvParser.js`) validates headers (`Name`, `Email`, `Matricule`, `Class`), checks for duplicates, creates `User` + `Student` records in a single database transaction, and dispatches credential emails.

### 4.10.3 Complete Cascading User Deletion Routine
- **FR-ADM-05 (Cascading Cleanup Execution):** Deleting a user (`/api/admin/users/:id`) executes comprehensive programmatic cleanup:
  - If target user is a **Student**: destroys `Student`, `Report`, `PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`, `ReportComment`, `Internship`, `Meeting`, `Task`, and `DefenseAlert` records, and removes student ID references from group meeting arrays.
  - If target user is a **Supervisor**: nullifies supervisor references in `Internships`, deletes supervisor-created meetings, and deletes supervised tasks.
  - Removes all `Notification` and `ReportComment` rows associated with target user ID.
- **FR-ADM-06 (Zero-Orphan Integrity Guarantee):** Deletion routine guarantees that no orphaned records or broken foreign key references linger in the database.

---

## 4.11 Timeline & Defense Alert Management (TIM)

- **FR-ADM-07 (Timeline Phase Management):** Admins can update institutional internship timeline dates and milestones (`/api/admin/timeline`).
- **FR-ADM-08 (Defense Alert Publishing):** Admins can schedule defense alerts (`/api/admin/defense-alerts`), specifying student ID, defense date, classroom location, and assigned jury panel members.
- **FR-ADM-09 (Student Defense Banner):** Designated students receive interactive defense alert banners on their dashboard displaying date, location, jury roster, and countdown timer.
