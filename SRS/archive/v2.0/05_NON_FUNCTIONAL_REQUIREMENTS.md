# 05. Non-Functional Requirements

## 5.1 Performance Requirements

- **NFR-PERF-01 (API Response Time):** Standard REST API endpoints (excluding external Gemini AI and complex plagiarism scans) shall respond within 150ms under normal load (up to 500 concurrent requests).
- **NFR-PERF-02 (AI Analysis Processing Speed):** PDF text extraction and Google Gemini AI report evaluations shall complete structured analysis and return JSON audit results within 8 to 12 seconds for standard report lengths (15 - 60 pages).
- **NFR-PERF-03 (Plagiarism Scan Latency):** Internal plagiarism candidate matching and N-gram fingerprint verification against an institutional database of up to 50,000 documents shall complete within 3.0 seconds per submitted report.
- **NFR-PERF-04 (Client Initial Load Time):** React SPA initial bundle download and first contentful paint (FCP) shall complete within 1.2 seconds over standard mobile 4G/broadband connections.
- **NFR-PERF-05 (Server-Side Pagination & Optimization):** All collection endpoints (Users, Students, Reports, Plagiarism Logs, Tasks, Meetings) must implement server-side pagination with a default size of 20 items per page to minimize memory consumption and DB payload sizes.

---

## 5.2 Security & Data Privacy

- **NFR-SEC-01 (Salted Password Hashing):** All user passwords must be hashed prior to storage using `bcrypt` with a minimum cost factor of 10 salt rounds. Plaintext passwords must never be stored, logged, or exposed in API responses.
- **NFR-SEC-02 (Stateless JWT Token Security):** JSON Web Tokens must be cryptographically signed using a strong secret key (`JWT_SECRET`) and configured with explicit expiration limits. Tokens must be transmitted exclusively via HTTPS headers.
- **NFR-SEC-03 (Strict Role-Based Authorization):** Every REST endpoint must enforce identity verification (`protect` middleware) and role privilege guards (`authorize` middleware) to prevent privilege escalation or horizontal data leakage between users.
- **NFR-SEC-04 (File Upload Sanitation & Storage):** File uploads (PDF reports, CSV rosters) must be sanitized using Multer middleware, validating exact MIME types (`application/pdf`, `text/csv`), enforcing maximum file size limits (10MB), and stripping potentially executable script headers.
- **NFR-SEC-05 (Plagiarism Repository Privacy & Access Isolation):** Student document text stored in the institutional repository must be restricted to authorized Academic Supervisors and Administrators. Matched source text snippets shown in the Plagiarism Inspector must be restricted to highlight snippets to protect student intellectual property and adhere to FERPA/GDPR guidelines.

---

## 5.3 Reliability & Cascading Data Integrity

- **NFR-REL-01 (Strict Referential Integrity):** Relational database foreign keys must maintain referential integrity with explicit deletion policies (`CASCADE` or `SET NULL`).
- **NFR-REL-02 (Zero-Orphan Deletion Policy):** The administrative user deletion workflow must guarantee 100% cascade cleanup across all 13 database tables, ensuring zero residual orphaned records (`Student`, `Report`, `PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`, `ReportComment`, `Meeting`, `Task`, `Notification`, `DefenseAlert`).
- **NFR-REL-03 (Fail-Safe External Service Isolation):** System failure in external third-party services (Gemini API timeout, SMTP dispatch failure, or Jitsi connection drop) must fail gracefully with appropriate transaction rollbacks, localized error logging, and user-friendly error messages without corrupting report or user database state.

---

## 5.4 Usability & UI Design System

- **NFR-USA-01 (Modern Aesthetic Excellence):** The React frontend application must strictly implement a modern dark-mode aesthetic featuring deep charcoal background panels (`var(--bg)`, `var(--bg-panel)`), vibrant accent highlights (`var(--orange-3)`, `var(--primary)`), sleek glassmorphism borders, and crisp Google Outfit/Inter typography.
- **NFR-USA-02 (Responsive Layout Adaptability):** The interface must render fluidly across mobile (375px+), tablet, desktop, and ultra-wide displays (1920px+) using responsive flexbox/grid architecture.
- **NFR-USA-03 (Interactive Micro-Animations & Inspector UX):** State updates, drawer sliders, modal popups, tab switches, and hover interactions must feature CSS micro-animations. The Plagiarism Inspector Modal must offer side-by-side comparative scrolling, synchronized line jumps, and distinct color-coded severity highlights (Green, Yellow, Red).

---

## 5.5 Maintainability & Scalability

- **NFR-MNT-01 (Separation of Concerns):** Backend code must maintain strict separation of concerns into `/models`, `/controllers`, `/routes`, `/middleware`, `/utils`, `/services`, and `/prompts`.
- **NFR-MNT-02 (Environment Variable Management):** All runtime configurations (Server Port, DB credentials, JWT Secret, SMTP settings, Gemini API keys, Plagiarism thresholds) must be dynamically loaded from environment variables (`.env`).
- **NFR-MNT-03 (Plagiarism Engine Algorithm Modularity):** The Plagiarism Detection Engine must be implemented as a decoupled, modular service (`plagiarismService.js`), enabling seamless upgrades or swap-outs of similarity algorithms (e.g. integrating external vector stores like pgvector or Turnitin API gateways) without modifying core controller logic.
- **NFR-MNT-04 (Standardized Error Payloads):** Asynchronous route handlers must catch exceptions and return standardized JSON error response structures (`{ success: false, message: "...", error: "..." }`) accompanied by HTTP status codes.
