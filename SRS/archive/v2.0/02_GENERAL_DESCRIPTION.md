# 02. General Description

## 2.1 Product Perspective

InternSmart is an autonomous, full-stack enterprise web platform engineered for higher education institutions and partner enterprise organizations. The system mediates and coordinates real-time interaction among four distinct user roles while managing data isolation, role-based navigation, automated notification cycles, AI report evaluation, and academic plagiarism verification.

### 2.1.1 Platform Context Diagram

```
                                ┌─────────────────────────────────────────────────────────┐
                                │              InternSmart Enterprise Platform            │
                                └────────────────────────────┬────────────────────────────┘
                                                             │
        ┌────────────────────────┼───────────────────────────┼──────────────────────────┐
        ▼                        ▼                           ▼                          ▼
 ┌──────────────┐         ┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
 │   Student    │         │ Academic Sup │         │ Professional Sup │         │ System Admin │
 └──────┬───────┘         └──────┬───────┘         └────────┬─────────┘         └──────┬───────┘
        │                        │                          │                          │
        └────────────────────────┴────────────┬─────────────┴──────────────────────────┘
                                              │ REST API / JSON (JWT Bearer Token)
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Express Node.js Middleware                                 │
│  [ Auth / Role Guards ] [ PDF Extraction Engine ] [ Plagiarism Detector ] [ AI Quota Manager]│
└───────┬────────────────────────────┬───────────────────────────────┬─────────────────────────┘
        │                            │                               │
        ▼                            ▼                               ▼
┌──────────────────┐       ┌──────────────────┐            ┌──────────────────┐
│ Google Gemini AI │       │ Internal Corpus  │            │ Jitsi Meet / SMTP│
│ (Report Audit)   │       │ Plagiarism Index │            │ (Video & Email)  │
└──────────────────┘       └────────┬─────────┘            └──────────────────┘
                                    │
                                    ▼
                       ┌──────────────────────────┐
                       │ Sequelize Relational DB  │
                       │ (Users, Reports, Scans)  │
                       └──────────────────────────┘
```

---

## 2.2 User Classes & Personas

### 2.2.1 Student User (`student`)
- **Profile:** Enrolled university student completing an academic or industry internship placement.
- **Primary Goals:**
  - Submit internship report drafts in PDF format and view extraction progress.
  - Access the interactive **AI Report Writing Workspace** for automated structural, grammatical, and technical quality checks.
  - Run **Plagiarism Pre-Scans** (if enabled by institutional settings) to identify potential uncited text matches prior to formal review.
  - Track assigned tasks, submit work notes/URLs, and monitor real-time completion status.
  - Participate in scheduled virtual check-in meetings via one-click Jitsi links.
  - Monitor internship milestone timelines, defense alerts, and final dual-supervisor evaluation grades.

### 2.2.2 Academic Supervisor User (`academic_supervisor`)
- **Profile:** University faculty member responsible for oversight of student academic performance and report authenticity.
- **Primary Goals:**
  - Oversee assigned cohort of student interns and monitor report submission progress.
  - Conduct comprehensive report reviews using AI audit metrics and extracted text view.
  - Access the **Internal Plagiarism Inspection Dashboard**: view similarity percentages, inspect side-by-side snippet comparisons, review matched original source documents (author, matricule, report title, submission year), and flag potential academic integrity violations.
  - Assign academic tasks, schedule individual/group video check-ins via Jitsi, and issue report revision requests.
  - Submit final academic evaluation grades based on institutional rubrics (max 20 points weight) with mandatory plagiarism compliance check.

### 2.2.3 Professional Supervisor User (`professional_supervisor`)
- **Profile:** Industry mentor supervising the student's workplace tasks and professional execution at the host company.
- **Primary Goals:**
  - Monitor company interns assigned to their corporate department.
  - Define work assignments and tasks with target due dates and technical specifications.
  - Review student task submissions, evaluate submitted work URLs, provide feedback notes, and mark task status (`completed`, `needs_revision`).
  - Schedule virtual check-in meetings via Jitsi Meet.
  - Submit final workplace evaluation grades based on professional competency rubrics (max 10 points weight).

### 2.2.4 System Administrator (`admin`)
- **Profile:** Institutional IT manager overseeing system setup, account security, and platform settings.
- **Primary Goals:**
  - Manage full CRUD lifecycle for Users, Students, Supervisors, and Internships.
  - Perform bulk student onboarding via validated CSV file upload.
  - Configure institutional internship timeline phases, milestone deadlines, and defense alert broadcasts.
  - Manage **Plagiarism Detection Configuration**: adjust global similarity alert thresholds (e.g., Warning at 15%, Flagged at 25%), manage excluded section rules (cover page, references, standard header formulas), and trigger institutional document index rebuilds.
  - Execute complete cascading user deletions without leaving orphaned records anywhere in the database.

---

## 2.3 Operating Environment

- **Client Hardware & Web Browsers:** Desktop, laptop, or tablet hardware running Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+. Requires JavaScript enabled, HTML5 WebSockets/WebRTC support for Jitsi Meet, and CSS Flexbox/Grid support.
- **Application Server:** Node.js Runtime Environment (v18.x or v20.x LTS) running on Linux (Ubuntu 20.04+/22.04 LTS) or Microsoft Windows Server environment.
- **Database Engine:** MySQL 8.0+ or PostgreSQL 14+ with full foreign key constraints, JSON data type support, and multi-column indexes on text hashes/fingerprints.
- **File Storage System:** Secure local or cloud file system destination (`/uploads`) storing original PDF report submissions and parsed document assets.

---

## 2.4 Design & Implementation Constraints

1. **Stateless JWT Security:** Authentication state is maintained exclusively via signed JWT tokens passed in HTTP Authorization headers (`Bearer <token>`). Server sessions are omitted for stateless scalability.
2. **AI Quota Rate Limiting:** Daily AI report analysis is capped at 3 requests per student per day to prevent Gemini API quota exhaustion and manage cloud computational costs.
3. **Single Active Submission & Version Control:** Each internship record maintains one primary report thread. Updating a report increments its version integer (e.g., v1 -> v2) and automatically re-triggers both text extraction and internal plagiarism scanning.
4. **Internal Plagiarism Index Isolation:** The plagiarism engine compares submissions exclusively against the institution's internal database repository (plus configurable external reference baselines). All student document fingerprints are indexed locally to guarantee data confidentiality and compliance with privacy regulations (GDPR / FERPA).
5. **Strict Cascading Referential Integrity:** Database model relationships MUST strictly enforce cascading deletions or programmatic multi-table cleanups. When an admin deletes a user, all child entity records (`Student`, `Internship`, `Report`, `PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`, `ReportComment`, `Meeting`, `Task`, `Notification`, `DefenseAlert`) MUST be completely removed or safely disassociated.

---

## 2.5 Assumptions & Dependencies

- **Email Services:** SMTP service credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) are configured for dispatching temporary passwords and password reset OTPs.
- **Jitsi Video Rooms:** Access to Jitsi public WebRTC gateway (`meet.jit.si`) or custom self-hosted Jitsi instance over HTTPS.
- **Google Gemini API:** Valid API key (`GEMINI_API_KEY`) with active quota for `@google/genai` library calls.
- **Text Parsing Reliability:** PDF document structures adhere to readable text encoding; scanned image-only PDFs require standard text conversion or OCR preprocessing.
