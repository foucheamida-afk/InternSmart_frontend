# InternSmart — Enterprise Software Requirements Specification (SRS)

Welcome to the official **Software Requirements Specification (SRS)** documentation suite for **InternSmart** — an AI-Powered Internship Management, Report Writing & Academic Plagiarism Detection Platform.

This documentation suite serves as the definitive single source of truth for platform architecture, system specifications, data models, functional requirements, and non-functional engineering standards.

---

## 📚 Document Suite Table of Contents

### 1. [**01. Introduction and Scope**](./01_INTRODUCTION_AND_SCOPE.md)
   - **1.1 Purpose:** Institutional purpose, multi-role ecosystem, and overall platform vision.
   - **1.2 Scope & Objective:** Six core operational pillars (Communication, AI Writing Workspace, **Internal Plagiarism Detection**, Dual Evaluation, Jitsi Video Meetings, Administrative Onboarding & Integrity).
   - **1.3 Target Audience:** Software Engineers, System Architects, Faculty Academic Supervisors, Quality Assurance, and IT Administrators.
   - **1.4 Definitions, Acronyms, and Abbreviations:** Comprehensive terminology table (JWT, OTP, ORM, Gemini API, Plagiarism Engine, Similarity Index, N-Gram, TF-IDF, Cosine Similarity, LSH, Corpus).
   - **1.5 Project Overview & Technical Foundation:** High-level platform architecture and technical stack summary.

### 2. [**02. General Description**](./02_GENERAL_DESCRIPTION.md)
   - **2.1 Product Perspective:** Autonomous web application architecture and Context Blueprint Diagram.
   - **2.2 User Classes & Personas:** Detailed user role capabilities:
     - 2.2.1 Student User (`student`) — Plagiarism pre-scans, AI feedback, task tracking, meeting participation.
     - 2.2.2 Academic Supervisor User (`academic_supervisor`) — Plagiarism Inspector Modal, side-by-side snippet review, rubric grading out of 20.
     - 2.2.3 Professional Supervisor User (`professional_supervisor`) — Workplace task tracking, work URL review, rubric grading out of 10.
     - 2.2.4 System Administrator (`admin`) — Entity CRUD, CSV onboarding, Plagiarism threshold tuning, timeline management, cascading deletion.
   - **2.3 Operating Environment:** Client hardware/browsers, Node.js backend, relational SQL database, and file storage.
   - **2.4 Design & Implementation Constraints:** Stateless JWT auth, daily AI quota limits, report versioning, internal plagiarism corpus isolation, strict database cascading deletion policies.
   - **2.5 Assumptions & Dependencies:** SMTP email dispatch, Jitsi WebRTC room links, Google Gemini API, text parsing fidelity.

### 3. [**03. System Architecture & Tech Stack**](./03_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md)
   - **3.1 Architectural Overview:** Decoupled client-server blueprint diagram featuring Plagiarism Engine tokenization, Sequelize ORM, and external services.
   - **3.2 Technology Stack:**
     - 3.2.1 Frontend Client — React 18, Vite, Tailwind CSS, Glassmorphism, Axios.
     - 3.2.2 Backend Application — Node.js, Express 5.x, Sequelize ORM, Multer, `pdf-parse`.
     - 3.2.3 **Internal Plagiarism Engine** — Preprocessor, K-Gram Fingerprinter, Jaccard Index, TF-IDF, Cosine Similarity, Gemini Paraphrase Auditor.
     - 3.2.4 External Services — Google Gemini 2.5 API, Jitsi Meet WebRTC, SMTP Nodemailer.
   - **3.3 Database Schema & Entity Relationships:**
     - 3.3.1 Entity Relationship Diagram (ERD) — 13 relational entities.
     - 3.3.2 Data Model Specifications — Detailed attribute tables for `User`, `Student`, `Internship`, `Report`, `PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`, `ReportComment`, `Task`, `Meeting`, `Notification`, `DefenseAlert`, and `TimelineSetting`.

### 4. [**04. Functional Requirements**](./04_FUNCTIONAL_REQUIREMENTS.md)
   - **4.1 Authentication & Access Control (AUTH):** Credentials login, JWT generation, password recovery, OTP verification, role guards (`FR-AUTH-01` to `FR-AUTH-08`).
   - **4.2 Student Dashboard & Profile Management (STU):** Progress indicators, profile details, timeline view (`FR-STU-01` to `FR-STU-03`).
   - **4.3 AI Report Writing Workspace & Error Inspector (AI):** PDF upload, text parsing, automated Gemini AI review, 3 daily quota enforcement, structured JSON errors (`FR-AI-01` to `FR-AI-09`).
   - **4.4 Internal Academic Plagiarism Detection Engine (PLAG):** Automated scan execution, multi-stage detection pipeline, Similarity Indexing (Clean <15%, Warning 15-25%, Flagged >25%), match attributions, Academic Supervisor Side-by-Side Plagiarism Inspector Modal, pre-grading enforcement guard, admin threshold configuration (`FR-PLAG-01` to `FR-PLAG-11`).
   - **4.5 Academic Supervisor Module (SUP):** Assigned intern list, report review, comments, grade submission out of 20 (`FR-SUP-01` to `FR-SUP-04`).
   - **4.6 Professional Supervisor Module (PSUP):** Company intern directory, work task assignments, task submission review, grade submission out of 10 (`FR-PSUP-01` to `FR-PSUP-04`).
   - **4.7 Meeting Management & WebRTC Video Conferencing (MTG):** Supervisor meeting scheduling, Jitsi WebRTC link generation, instant student notification, one-click launch (`FR-MTG-01` to `FR-MTG-05`).
   - **4.8 Task Management & Progress Tracking (TSK):** Student task board, progress submission (0-100%), work URL attachment, supervisor inspection drawer (`FR-TSK-01` to `FR-TSK-04`).
   - **4.9 Dual-Supervisor Evaluation & Grading System (GRD):** Dual grade weighting (20/10 split), structured JSON rubrics, student final grade view (`FR-GRD-01` to `FR-GRD-03`).
   - **4.10 Administrator Dashboard & Cascading User Cleanup (ADM):** Entity CRUD, automated credential emails, bulk CSV import, 100% cascading user deletion routine (`FR-ADM-01` to `FR-ADM-06`).
   - **4.11 Timeline & Defense Alert Management (TIM):** Timeline phase updates, defense alert scheduling, student defense banner (`FR-TIM-01` to `FR-TIM-03`).

### 5. [**05. Non-Functional Requirements**](./05_NON_FUNCTIONAL_REQUIREMENTS.md)
   - **5.1 Performance Requirements:** API response times (<150ms), AI analysis speed (8-12s), plagiarism scan latency (<3s), client FCP (<1.2s), server-side pagination (`NFR-PERF-01` to `NFR-PERF-05`).
   - **5.2 Security & Data Privacy:** Salted bcrypt password hashing, stateless JWT security, strict role authorization, Multer file upload sanitation, plagiarism document privacy (`NFR-SEC-01` to `NFR-SEC-05`).
   - **5.3 Reliability & Data Integrity:** Referential integrity, zero-orphan cascading deletion guarantee, fail-safe isolation (`NFR-REL-01` to `NFR-REL-03`).
   - **5.4 Usability & UI Design System:** Modern dark mode aesthetics, glassmorphism UI, responsive adaptability, Plagiarism Inspector UX (`NFR-USA-01` to `NFR-USA-03`).
   - **5.5 Maintainability & Scalability:** Modular architecture, environment variables, Plagiarism Engine algorithm modularity, standardized error payloads (`NFR-MNT-01` to `NFR-MNT-04`).

---

## 📌 Revision History & Document Control

| Version | Release Date | Summary of Changes | Author / Contributor | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1.0.0** | August 2026 | Initial baseline Software Requirements Specification. | Development Team | Superseded |
| **1.1.0** | September 2026 | Integrated Jitsi Meet WebRTC meeting dispatches and Cascading User Cleanup requirements. | Development Team | Superseded |
| **2.0.0** | September 2026 | Enterprise Edition: Comprehensive upgrade across all SRS modules. Integrated the **Internal Academic Plagiarism Detection Engine**, new data models (`PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`), side-by-side Plagiarism Inspector specifications, and NFR benchmarks. | Lead Software Architect & AI Engineering Team | **Approved / Final Specification** |
