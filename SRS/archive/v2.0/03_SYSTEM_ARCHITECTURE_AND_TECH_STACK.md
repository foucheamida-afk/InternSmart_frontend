# 03. System Architecture & Tech Stack

## 3.1 Architectural Overview

InternSmart adheres to a multi-tiered **Decoupled Client-Server Architecture**. The application separates client-side rendering and interaction from server-side business logic, security enforcement, AI document auditing, and plagiarism indexing. Communication between client and server occurs strictly via standard RESTful HTTP/HTTPS endpoints using JSON data payloads and JWT Bearer authentication headers.

### 3.1.1 Enterprise System Architecture Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Client Tier                            │
│  React 18 + Vite | Tailwind CSS | Lucide Icons | Axios | Context API   │
│  [ Dashboard ] [ Writing Workspace ] [ Plagiarism Inspector Modal ]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / JSON (Bearer JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Backend Application Tier                        │
│  Node.js + Express.js | Auth Middleware | Role Guards | Multer Engine   │
│  ┌───────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ PDF Text Extractor    │  │ Internal Plagiarism Engine           │  │
│  │ (pdf-parse / Stream)  │  │ (N-Gram Hashing, TF-IDF, Cosine)     │  │
│  └───────────────────────┘  └──────────────────────────────────────┘  │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
        ▼                           ▼                            ▼
┌─────────────────┐       ┌──────────────────┐        ┌──────────────────┐
│   Sequelize     │       │ Google Gemini AI │        │ Jitsi Meet & SMTP│
│   (ORM Layer)   │       │ (Semantic Review)│        │ (Video & Email)  │
└───────┬─────────┘       └──────────────────┘        └──────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Relational Database Tier                        │
│  MySQL 8.0+ / PostgreSQL 14+                                           │
│  [ Users ] [ Students ] [ Reports ] [ PlagiarismScans ] [ Fingerprints]│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3.2 Technology Stack

### 3.2.1 Frontend (Client Tier)
- **Core Framework & Build Tool:** React 18 SPA bundled with Vite for high-speed module serving and hot module replacement.
- **Client Routing:** React Router v6 (`AppRouter.jsx`) featuring nested route protection, dynamic navigation, and layout wrappers.
- **Styling Architecture:** Vanilla CSS design variables integrated with Tailwind CSS for rapid layout utilities, custom glassmorphism panels, CSS micro-animations, and full dark mode styling.
- **Icons & Visual Components:** Lucide React (`lucide-react`) icon set.
- **HTTP Communications:** Axios client featuring centralized instance configuration (`api.js`), response error interceptors, and automatic JWT header injection.

### 3.2.2 Backend (Application Tier)
- **Runtime Environment:** Node.js (v18.x / v20.x LTS) with native ES Modules support (`"type": "module"`).
- **Web Framework:** Express.js 5.x REST API engine with modular routing architecture.
- **Database ORM:** Sequelize ORM with `mysql2` / `pg` relational database drivers.
- **Authentication & Security:** `jsonwebtoken` (JWT) for stateless identity verification, `bcrypt` for salted password hashing, and custom role-based route middleware (`protect`, `authorize`).
- **File Upload Engine:** `multer` handling binary PDF and CSV file streams to local disk destination (`/uploads`).
- **Document Text Extraction:** `pdf-parse` for fast text extraction from binary PDF buffers into raw text strings.

### 3.2.3 Internal Academic Plagiarism Detection Engine
- **Text Tokenizer & Preprocessor:** Normalized text cleaner removing punctuation, stop words, standard page numbers, cover page patterns, and reference headings.
- **Fingerprinting & N-Gram Generator:** Extracts word-level k-grams ($k = 5$ to $10$) and computes hash fingerprints (MD5 / MurmurHash) for rapid index matching.
- **Similarity Algorithms:**
  - **Jaccard Similarity Coefficient:** Evaluates set overlap of extracted document n-grams.
  - **TF-IDF & Cosine Similarity:** Computes vector angle comparison between document frequency models for structural equivalence.
  - **Gemini Semantic Paraphrase Auditor:** Optional deep semantic check invoking Gemini AI to detect reworded passages or heavy AI-assisted paraphrasing.

### 3.2.4 External Services & Integrations
- **Google Gemini AI Engine:** `@google/genai` (Gemini 2.5) for automated quality reviews, structure scoring, grammar evaluation, and detailed section feedback.
- **Virtual Meeting Infrastructure:** Jitsi Meet WebRTC platform utilizing dynamic room URL generation (`https://meet.jit.si/internsmart-<hash>`).
- **Email Notification System:** `nodemailer` operating via SMTP transport for automated password distribution, OTP generation, and plagiarism alert dispatches.

---

## 3.3 Database Schema & Entity Relationships

The platform relational database model consists of **13 interconnected entities** configured with explicit foreign key constraints and cascading cleanup policies.

### 3.3.1 Entity Relationship Diagram (ERD)

```
[ User ] (id, name, email, password, role, isBlocked, ...)
   │
   ├── (1:1) ──► [ Student ] (id, userId, matricule, class)
   │               │
   │               ├── (1:1) ──► [ Internship ] (id, studentId, academicSupervisorId, professionalSupervisorId, company, ...)
   │               │
   │               ├── (1:N) ──► [ Report ] (id, studentId, title, fileUrl, version, status, aiScore, aiAnalysis, ...)
   │               │               │
   │               │               ├── (1:1) ──► [ PlagiarismScan ] (id, reportId, similarityScore, status, scannedAt, ...)
   │               │               │               └── (1:N) ──► [ PlagiarismMatch ] (id, plagiarismScanId, matchedReportId, ...)
   │               │               │
   │               │               ├── (1:N) ──► [ DocumentFingerprint ] (id, reportId, hashSignature, ngramTokens, ...)
   │               │               │
   │               │               └── (1:N) ──► [ ReportComment ] (id, reportId, userId, comment)
   │               │
   │               ├── (1:N) ──► [ Task ] (id, studentId, supervisorId, title, status, progress, feedback, ...)
   │               ├── (1:N) ──► [ Meeting ] (id, studentId, createdBy, title, date, meetingLink, status, ...)
   │               └── (1:N) ──► [ DefenseAlert ] (id, studentId, defenseDate, location, juryMembers, ...)
   │
   └── (1:N) ──► [ Notification ] (id, userId, title, message, type, isRead, meetingLink, ...)
```

---

### 3.3.2 Data Model Specifications

#### 1. User (`users`)
- `id`: INTEGER (PK, Auto-Increment)
- `name`: STRING (Not Null)
- `email`: STRING (Unique, Not Null)
- `password`: STRING (Not Null, Bcrypt hash)
- `role`: ENUM (`student`, `academic_supervisor`, `professional_supervisor`, `admin`)
- `isBlocked`: BOOLEAN (Default: `false`)
- `otpCode`: STRING (Nullable, 6-digit verification code)
- `otpExpires`: DATE (Nullable, OTP expiration timestamp)
- `createdAt`, `updatedAt`: DATE

#### 2. Student (`students`)
- `id`: INTEGER (PK, Auto-Increment)
- `userId`: INTEGER (FK -> `users.id`, OnDelete: CASCADE, Unique)
- `matricule`: STRING (Unique, Not Null)
- `class`: STRING (Not Null)
- `createdAt`, `updatedAt`: DATE

#### 3. Internship (`internships`)
- `id`: INTEGER (PK, Auto-Increment)
- `studentId`: INTEGER (FK -> `students.id`, OnDelete: CASCADE, Unique)
- `academicSupervisorId`: INTEGER (FK -> `users.id`, OnDelete: SET NULL, Nullable)
- `professionalSupervisorId`: INTEGER (FK -> `users.id`, OnDelete: SET NULL, Nullable)
- `company`: STRING (Not Null)
- `academicGrade`: FLOAT (Nullable, 0 - 20)
- `academicGradeBreakdown`: JSON (Nullable, structured rubric scores)
- `academicGradeStatus`: ENUM (`pending`, `submitted`)
- `professionalGrade`: FLOAT (Nullable, 0 - 10)
- `professionalGradeBreakdown`: JSON (Nullable, structured rubric scores)
- `professionalGradeStatus`: ENUM (`pending`, `submitted`)
- `createdAt`, `updatedAt`: DATE

#### 4. Report (`reports`)
- `id`: INTEGER (PK, Auto-Increment)
- `studentId`: INTEGER (FK -> `students.id`, OnDelete: CASCADE)
- `title`: STRING (Not Null)
- `fileName`: STRING (Not Null)
- `fileUrl`: STRING (Not Null)
- `version`: INTEGER (Default: 1)
- `status`: ENUM (`draft`, `submitted`, `ai_analysis`, `in_review`, `approved`, `needs_revision`)
- `progress`: INTEGER (Default: 0, 0-100%)
- `aiScore`: FLOAT (Nullable, 0 - 10)
- `aiAnalysis`: JSON (Nullable, structural scores, grammar review, suggestions)
- `documentContent`: LONGTEXT (Extracted raw text from PDF)
- `createdAt`, `updatedAt`: DATE

#### 5. PlagiarismScan (`plagiarism_scans`)
- `id`: INTEGER (PK, Auto-Increment)
- `reportId`: INTEGER (FK -> `reports.id`, OnDelete: CASCADE, Unique)
- `similarityScore`: FLOAT (Not Null, 0.0 to 100.0%)
- `status`: ENUM (`clean`, `warning`, `flagged`, `processing`, `failed`)
- `scannedAt`: DATE (Default: CURRENT_TIMESTAMP)
- `matchedSourcesCount`: INTEGER (Default: 0)
- `analysisDetails`: JSON (Summary of top matching sources, n-gram metrics, excluded section counts)
- `createdAt`, `updatedAt`: DATE

#### 6. PlagiarismMatch (`plagiarism_matches`)
- `id`: INTEGER (PK, Auto-Increment)
- `plagiarismScanId`: INTEGER (FK -> `plagiarism_scans.id`, OnDelete: CASCADE)
- `matchedReportId`: INTEGER (FK -> `reports.id`, OnDelete: CASCADE)
- `similarityPercentage`: FLOAT (Not Null, 0.0 to 100.0%)
- `matchedText`: TEXT (Not Null, highlighted text snippet from submitted report)
- `sourceText`: TEXT (Not Null, corresponding text snippet from matched repository report)
- `startChar`: INTEGER (Character offset in submitted report)
- `endChar`: INTEGER (End character offset in submitted report)
- `sourceStartChar`: INTEGER (Character offset in matched source report)
- `sourceEndChar`: INTEGER (End character offset in matched source report)
- `createdAt`, `updatedAt`: DATE

#### 7. DocumentFingerprint (`document_fingerprints`)
- `id`: INTEGER (PK, Auto-Increment)
- `reportId`: INTEGER (FK -> `reports.id`, OnDelete: CASCADE)
- `hashSignature`: STRING (Not Null, MD5/MurmurHash hash of k-gram token)
- `chunkIndex`: INTEGER (Not Null, sequential position in document)
- `ngramTokens`: TEXT (Raw k-gram token string)
- `createdAt`: DATE

#### 8. ReportComment (`report_comments`)
- `id`: INTEGER (PK, Auto-Increment)
- `reportId`: INTEGER (FK -> `reports.id`, OnDelete: CASCADE)
- `userId`: INTEGER (FK -> `users.id`, OnDelete: CASCADE)
- `comment`: TEXT (Not Null)
- `createdAt`, `updatedAt`: DATE

#### 9. Task (`tasks`)
- `id`: INTEGER (PK, Auto-Increment)
- `studentId`: INTEGER (FK -> `students.id`, OnDelete: CASCADE)
- `supervisorId`: INTEGER (FK -> `users.id`, OnDelete: CASCADE)
- `title`: STRING (Not Null)
- `description`: TEXT (Not Null)
- `dueDate`: DATE (Not Null)
- `status`: ENUM (`pending`, `in_progress`, `submitted`, `completed`, `needs_revision`)
- `completed`: BOOLEAN (Default: `false`)
- `progress`: INTEGER (Default: 0, 0-100%)
- `submissionNote`: TEXT (Nullable)
- `workUrl`: STRING (Nullable)
- `feedback`: TEXT (Nullable)
- `createdAt`, `updatedAt`: DATE

#### 10. Meeting (`meetings`)
- `id`: INTEGER (PK, Auto-Increment)
- `studentId`: INTEGER (FK -> `students.id`, OnDelete: CASCADE, Nullable for group meetings)
- `studentIds`: JSON (Nullable array of student IDs for group meetings)
- `isGroupMeeting`: BOOLEAN (Default: `false`)
- `createdBy`: INTEGER (FK -> `users.id`, OnDelete: CASCADE)
- `title`: STRING (Not Null)
- `description`: TEXT (Nullable)
- `date`: DATE (Not Null)
- `meetingLink`: STRING (Not Null, Jitsi WebRTC URL)
- `status`: ENUM (`scheduled`, `completed`, `cancelled`)
- `createdAt`, `updatedAt`: DATE

#### 11. Notification (`notifications`)
- `id`: INTEGER (PK, Auto-Increment)
- `userId`: INTEGER (FK -> `users.id`, OnDelete: CASCADE)
- `title`: STRING (Not Null)
- `message`: STRING (Not Null)
- `type`: ENUM (`info`, `success`, `warning`, `error`)
- `isRead`: BOOLEAN (Default: `false`)
- `meetingLink`: STRING (Nullable, action launch link)
- `createdAt`, `updatedAt`: DATE

#### 12. DefenseAlert (`defense_alerts`)
- `id`: INTEGER (PK, Auto-Increment)
- `studentId`: INTEGER (FK -> `students.id`, OnDelete: CASCADE)
- `defenseDate`: DATE (Not Null)
- `location`: STRING (Not Null)
- `juryMembers`: STRING (Not Null)
- `status`: ENUM (`scheduled`, `completed`, `postponed`)
- `createdAt`, `updatedAt`: DATE

#### 13. TimelineSetting (`timeline_settings`)
- `id`: INTEGER (PK, Auto-Increment)
- `label`: STRING (Not Null)
- `startDate`: DATE (Not Null)
- `endDate`: DATE (Not Null)
- `milestones`: JSON (Array of milestone step objects)
- `createdAt`, `updatedAt`: DATE
