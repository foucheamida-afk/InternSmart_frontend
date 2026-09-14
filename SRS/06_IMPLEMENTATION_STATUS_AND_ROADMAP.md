# 06. Implementation Status & Roadmap

**Version 2.1.0 — As-Built Edition · Audit date 2026-09-14 · Repository state: commit `77420df` (2026-09-11)**

This document answers a single question: **how much of this specification is actually implemented?** It is the evidence base for the status labels used throughout the suite.

---

## 6.1 Headline Verdict

| Measure | Result |
| :--- | :--- |
| Requirements audited | **80** (60 functional + 20 non-functional) |
| **Fully implemented** | **24 — 30.0 %** |
| Partially implemented | **36 — 45.0 %** |
| Not implemented (roadmap) | **16 — 20.0 %** |
| Not verifiable statically (runtime targets) | **4 — 5.0 %** |
| **Present at least partially** (implemented + partial) | **60 of 80 — 75.0 %** |
| Weighted completeness (implemented = 1, partial = 0.5) | **52.5 %** |
| Operational pillars delivered | **5 of 6** |

**The single most important finding:** the **Internal Academic Plagiarism Detection Engine**, which v2.0 presents as the flagship of the release, is **0 % implemented**. It accounts for **11 of the 13 missing functional requirements** (85 %). Excluding that one module, the remaining delivered scope is **95.9 % present** (47 of 49 requirements implemented or partial) — the platform is substantially built, and the specification's centre of gravity simply does not match the code. *(Figures updated 2026-09-14 after the P0 and correctness passes.)*

For a non-technical reader: the platform manages internships, reports, supervision, tasks, meetings and grades today; it does **not** check reports for plagiarism, and it does **not** let a user recover a forgotten password.

---

## 6.2 Functional Coverage by Module

| Module | Implemented | Partial | Missing | Total | % fully |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 4.1 Authentication & Access Control (AUTH) | 8 | 0 | 0 | 8 | 100 % |
| 4.2 Student Dashboard & Profile (STU) | 1 | 2 | 0 | 3 | 33.3 % |
| 4.3 AI Writing Workspace (AI) | 3 | 6 | 0 | 9 | 33.3 % |
| 4.4 **Plagiarism Detection (PLAG)** | **0** | **0** | **11** | **11** | **0 %** |
| 4.5 Academic Supervisor (SUP) | 0 | 4 | 0 | 4 | 0 % |
| 4.6 Professional Supervisor (PSUP) | 3 | 1 | 0 | 4 | 75.0 % |
| 4.7 Meeting Management (MTG) | 3 | 2 | 0 | 5 | 60.0 % |
| 4.8 Task Management (TSK) | 2 | 2 | 0 | 4 | 50.0 % |
| 4.9 Dual Evaluation & Grading (GRD) | 0 | 3 | 0 | 3 | 0 % |
| 4.10 Administration & Cleanup (ADM) | 1 | 4 | 1 | 6 | 16.7 % |
| 4.11 Timeline & Defence Alerts (TIM) | 1 | 1 | 1 | 3 | 33.3 % |
| **Total** | **22** | **25** | **13** | **60** | **36.7 %** |

## 6.3 Non-Functional Coverage

| Group | Implemented | Partial | Missing | Not verifiable | Total |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 5.1 Performance (PERF) | 0 | 1 | 0 | 4 | 5 |
| 5.2 Security & Privacy (SEC) | 2 | 2 | 1 | 0 | 5 |
| 5.3 Reliability & Integrity (REL) | 0 | 3 | 0 | 0 | 3 |
| 5.4 Usability & UI (USA) | 0 | 3 | 0 | 0 | 3 |
| 5.5 Maintainability (MNT) | 0 | 2 | 2 | 0 | 4 |
| **Total** | **2** | **11** | **3** | **4** | **20** |

Only **one** non-functional requirement (`NFR-SEC-01`, bcrypt cost 10) is fully satisfied. The weakest areas are **data integrity** (`NFR-REL-01`, `-03`: no foreign keys, no transactions) and **maintainability** (`NFR-MNT-02`, `-03`, `-04`: hardcoded configuration, empty service module, 0/314 standardised error responses).

## 6.4 Data Model Conformance

**10 of the 13 entities documented in v2.0 exist.** Missing entirely: `PlagiarismScan`, `PlagiarismMatch`, `DocumentFingerprint`.

| Aspect | v2.0 claim | Reality |
| :--- | :--- | :--- |
| Table naming | snake_case plural (`users`, `plagiarism_scans`) | Sequelize default **PascalCase plural** — `Users`, `Students`, `Internships`, `Reports`, `ReportComments`, `Tasks`, `Meetings`, `Notifications`, `DefenseAlerts`, `TimelineSettings` |
| FK constraints | "explicit foreign key constraints and cascading deletion rules" | **None.** No `onDelete`/`references` in any of the 14 association pairs; `sync()` generates no FKs |
| `User` status | `isBlocked`, `otpCode`, `otpExpires` | `active`, `mustChangePassword`, `status`, `lastLoginAt`, `lastLogoutAt`, `deactivatedAt` — **all three documented fields absent** |
| `Report.documentContent` | `LONGTEXT` (plain text) | `JSON` holding a structured editor document tree |
| `Report.status` enum | includes `draft` | `draft` absent; `rejected` added |
| `ReportComment` | single `comment` field | `section` + `body` + composite index |
| `Task.status` | `ENUM` | plain `STRING`; `description`/`dueDate` nullable |
| `DefenseAlert` | `location`, `juryMembers` (Not Null) | **both absent**; status enum differs |
| `Internship` | split grade fields only | split fields **plus** an unused legacy `finalGrade`/`gradeBreakdown`/`gradeStatus` set, still migrated on startup (`server.js:74-91`) |

## 6.5 Technology Stack Conformance

| v2.0 claim | Reality | Verdict |
| :--- | :--- | :--- |
| React 18 | `react 19.2.8` | Mismatch |
| React Router v6 (`AppRouter.jsx`) | `react-router-dom 7.18.2`; the live router is **`App.jsx`** — `AppRouter.jsx` is dead code | Mismatch |
| Vite, Tailwind, Lucide, Axios | `vite 8.2.0`, `tailwindcss 4.3.3`, `lucide-react 1.31.0`, `axios 1.19.0` | Match |
| Express 5.x, ES Modules | `express 5.2.1`, `"type": "module"` | Match |
| Sequelize ORM + mysql2/pg | `sequelize ^6.37.8` declared in `package.json`, recorded in `package-lock.json`, installed in `server/node_modules`, and verified to boot with the stray ancestor install hidden. **Fixed 2026-09-14** (was undeclared). The DB dialect remains hardcoded to MySQL | Match *(was severe mismatch)* |
| Gemini 2.5 | primary default is **not** 2.5; 2.5 is the fallback (`geminiService.js:47,67`) | Partial |
| Daily AI limit 3 | **5**, shared across AI features | Mismatch |
| `emailService.js`, `csvProcessor.js`, `videoService.js`, `scheduleService.js`, `deadlineJob.js` | all **0 bytes**; real mailer is `utils/sendEmail.js`, real parser is `utils/csvParser.js` | Mismatch |
| `SMTP_HOST/PORT/USER/PASS` | real keys are `EMAIL_HOST/PORT/USER/PASS/FROM` | Mismatch |
| 10 MB upload cap | Enforced on the report, CSV **and** AI upload paths (the AI path was 20 MB until 2026-09-14); Multer limit errors now return 413 | Match |
| **No mention of Socket.IO, Yjs, Tiptap, Hocuspocus** | all installed; `socket.io` is **entirely unused** (0-byte `config/socket.js`), while Tiptap/Yjs/Hocuspocus power a collaborative rich-text editor that v2.0 describes only as a "split-screen text view" | Undocumented extras |

## 6.6 Dead-Code Register

Fifteen source files are **entirely empty (0 bytes)**. Several are named by v2.0 as real components, so they create a false impression of coverage:

| File | Impact |
| :--- | :--- |
| `server/services/plagiarismService.js` | The named home of the entire plagiarism engine (`NFR-MNT-03`) |
| `server/services/emailService.js` | Named by v2.0; real mailer is `utils/sendEmail.js` |
| `server/services/videoService.js` | Named by v2.0; Jitsi logic lives inline in controllers |
| `server/services/scheduleService.js` | Named by v2.0; no scheduler exists |
| `server/jobs/deadlineJob.js` | No deadline/background job exists |
| `server/utils/csvProcessor.js` | Named by v2.0; real parser is `utils/csvParser.js` |
| `server/utils/textExtractor.js` | Named by v2.0; real extractor is `utils/extractPdfText.js` |
| `server/controllers/reportController.js` | Unwired |
| `server/routes/reportRoutes.js` | Unwired **and** unmounted in `server.js` |
| `server/config/socket.js` | Socket.IO never initialised despite the dependency |
| `server/models/aiModel.js` | Unused model file |
| `server/models/supervisorModel.js` | Unused model file |
| `client/src/context/RoleContext.jsx` | Unused context |
| `client/src/layouts/AuthLayout.jsx` | Unused layout |
| `client/src/layouts/DashboardLayout.jsx` | Unused layout |

Additionally **non-empty but unreferenced**: `server/utils/csvParser.js` (imported by nothing) and `client/src/router/AppRouter.jsx` (never imported — `main.jsx` loads `App.jsx`).

## 6.7 Highest-Risk Defects

Ordered by severity. These are correctness and deployability problems, distinct from unmet features.

1. ~~**`sequelize` is an undeclared, uninstalled dependency.**~~ **RESOLVED 2026-09-14** — `sequelize ^6.37.8` is now declared in `package.json`, locked in `package-lock.json`, and installed in `server/node_modules`; the API was verified to boot and connect with the stray ancestor install hidden.
2. ~~**Login breaks on Linux.**~~ **RESOLVED 2026-09-14** — the import now matches `utils/generateJWT.js` case-exactly. A repo-wide sweep of all **308 relative imports across 132 files** found this to be the **only** case mismatch.
3. ~~**Password recovery is broken.**~~ **FULLY RESOLVED 2026-09-14** — `passwordRoutes.js` uses named imports, and the entire OTP recovery flow is now implemented and tested end-to-end (see the fourth remediation entry in §6.11). `/change-password` still demands a token (401 without one).
4. ~~**The first-login password screen crashes.**~~ **RESOLVED 2026-09-14** — the requirements list is now rendered from the single `passwordRequirements` array, removing the undefined `passwordRules` reference and the duplicated markup.
5. ~~**No transactions anywhere.**~~ **RESOLVED 2026-09-14** — `deleteUser` runs in one transaction (and nulls the previously dangling `*By` reference columns), each CSV import row runs in its own transaction, and the AI review path now compensates: text is extracted *before* any state change, the prior report status/progress is restored on failure, and the daily request is refunded. Verified on a scratch database (rollback forced after `User.create` → 0 rows) and with a deliberately invalid Gemini key (report returned to `submitted`/0; quota charged to 2 then refunded to 1).
6. ~~**No foreign keys at all.**~~ **CORRECTED 2026-09-14 — the original claim was wrong.** Sequelize infers `references` from associations, so `sync()` **does** create foreign keys: a freshly synced schema has **13** FK constraints, with `CASCADE`/`SET NULL` chosen by whether the column is nullable. **The live database has only 7**, because `sync({ force: false })` never alters pre-existing tables — `internships→students`, `internships→users` (×2), `meetings→students` and `tasks→users` are unenforced there. Note `reports→students` is `SET NULL`, so a database-level student delete would *orphan* reports rather than remove them — which is precisely why the programmatic routine is still required. *(Partially open — `NFR-REL-01`.)*
7. ~~**The 10 MB upload cap is bypassed on the AI path**~~ **RESOLVED 2026-09-14** — the AI uploader is now 10 MB with an exact MIME check, returns **413** when over the limit, and `/api/ai/*` carries a role guard (verified: admin → 403, student → allowed, anonymous → 401). **Remaining sub-item:** the CSV uploader still accepts `text/csv` or any `.csv` filename.
8. ~~**Configuration is hardcoded.**~~ **RESOLVED 2026-09-14** — DB name/user/password/host/port/dialect, the server port, the client API base URL and the email portal link are all environment-driven with behaviour-preserving fallbacks; `PORT`, `DB_PORT` and `CLIENT_URL` were added to `.env`. *(The AI daily limit remains a hardcoded constant in two places.)*
9. **Upload validation is extension-based**, not the specified exact-MIME allow-list, and no script-header stripping exists.
10. **Grade integrity is cosmetic.** The academic grade has no server-side 20-point cap and no rubric validation, and the two supervisor grades are never combined into the composite score the SRS requires.

### Newly discovered during the 2026-09-14 remediation

11. ~~**JSON columns arrive as strings on MariaDB.**~~ **FIXED CENTRALLY 2026-09-14** — MariaDB implements `JSON` as `LONGTEXT`, so Sequelize returned JSON columns as raw strings: `Reports.aiAnalysis` came back as a **13,949-character string** and `milestones` as `"[]"`, which meant `aiAnalysis.metrics` was `undefined` and `milestones.map(...)` would throw. The originally reported symptom was that `deleteUser`'s group-meeting pruning tested `Array.isArray(...)` and therefore never ran. `config/db.js` now registers a global `afterFind` hook that parses any JSON-typed attribute arriving as a string, so every controller **and every API response** sees a real object/array. Verified after the change: `aiAnalysis.metrics.structure` = 75, `aiAnalysis.suggestions.length` = 18, and `documentContent` round-trips as a `{type:'doc'}` object.
12. ~~**The app could not bootstrap a fresh database.**~~ **FIXED 2026-09-14** — `server.js` ran the `ensure*Columns()` helpers *before* `sequelize.sync()`, and those helpers call `describeTable()` on tables they assume exist, so a brand-new database aborted startup with `No description found for "Tasks" table`. This was masked because the tables already existed in the development database. Fixed by running `sync()` first (verified: 10 tables created from an empty database).
13. ~~**Silent truncation.**~~ **FIXED 2026-09-14** — the server's `sql_mode` omits `STRICT_TRANS_TABLES`, so a 300-character matricule was silently truncated to fit `VARCHAR(255)`. `config/db.js` now sets `STRICT_TRANS_TABLES` **per connection**, scoped to this application so the other databases on the same MariaDB instance are unaffected (opt out with `DB_STRICT_MODE=false`). Verified: the over-length matricule is now rejected, while a battery of twelve write paths across all four roles — dates, JSON milestones, rubric JSON, CSV import, user creation — still succeeds.

## 6.8 Documentation-Drift Register (v2.0 → v2.1)

| # | v2.0 stated | Reality | Recommended resolution |
| :-- | :--- | :--- | :--- |
| 1 | Internal plagiarism engine delivered | 0-byte service, no models/routes/UI | **Decide:** build (`FR-PLAG-01..11`) or formally descope and remove the landing-page claim |
| 2 | OTP password recovery | Stub + broken route; no OTP at all | Build the flow, or amend to "authenticated password change only" |
| 3 | React 18 / Router v6 | React 19 / Router v7 | Amend SRS (done in v2.1) |
| 4 | 13 entities, snake_case, FK cascades | 10 entities, PascalCase, no FKs | Amend SRS (done) **and** add FKs (`NFR-REL-01`) |
| 5 | `isBlocked`, `otpCode`, `otpExpires` | `active` + tracking fields | Amend SRS (done) |
| 6 | `documentContent` LONGTEXT | JSON editor tree | Amend SRS (done); normalise before any fingerprinting work |
| 7 | 3 AI runs/day | 5/day, shared counter | Amend SRS **or** change the constant |
| 8 | "Gemini 2.5" | non-2.5 primary + 2.5 fallback | Amend SRS (done) |
| 9 | `/api/password/*`, `/api/student/*`, `/api/supervisor/grade` | `/api/users/*`, `/api/students/*`, `/api/supervisor/interns/:id/grade` | Amend SRS (done) |
| 10 | 10 MB cap, exact MIME | Was 20 MB on the AI path, with extension-based checks elsewhere | **Fixed in code 2026-09-14** — 10 MB and exact MIME on both PDF paths (CSV MIME still lenient) |
| 11 | `SMTP_*` env names | `EMAIL_*` | Amend SRS (done) |
| 12 | Standardised error envelope | 0 of 314 responses comply | Fix code **or** drop the requirement |
| 13 | Read-only "split-screen" workspace | Editable collaborative editor (Tiptap/Yjs) | Amend SRS (done) |
| 14 | `FR-ADM-07..09` vs `FR-TIM-01..03` ID collision | Both used for §4.11 | Resolved in v2.1 → `FR-TIM-01..03` |
| 15 | (unmentioned) Socket.IO, Yjs, Hocuspocus | Installed; Socket.IO entirely unused | Amend SRS (done) **or** remove unused deps |

## 6.9 Remediation Roadmap

### P0 — Correctness & deployability (do first; these block everything else)
1. ~~Add `sequelize` to `server/package.json` and verify a clean `npm ci && npm start`.~~ **DONE 2026-09-14** — declared as `^6.37.8`, locked, installed, and boot-verified with the stray ancestor install hidden.
2. ~~Fix the `generatejwt.js` → `generateJWT.js` case mismatch.~~ **DONE 2026-09-14** — fixed, and a repo-wide sweep confirmed it was the only case mismatch among 308 relative imports in 132 files.
3. ~~Fix the `passwordRoutes.js` double default-import; either implement the reset flow or return an honest "not supported" response.~~ **DONE 2026-09-14** — the import was fixed, and the **full OTP recovery flow was subsequently implemented** (`FR-AUTH-04..06`): emailed 6-digit code, 15-minute expiry, 5-attempt cap, single-use reset token. Password recovery now works end to end.
4. ~~Fix the undefined `passwordRules` reference in `ChangePassword.jsx`.~~ **DONE 2026-09-14** — the list now renders from the single `passwordRequirements` array.
5. ~~Move DB credentials, port and client API base URL into environment variables (`NFR-MNT-02`).~~ **DONE 2026-09-14** — including the email portal link; `.env` extended with `PORT`, `DB_PORT`, `CLIENT_URL`.
6. ~~Wrap user deletion and CSV import in transactions (`NFR-REL-03`).~~ **DONE 2026-09-14** — plus the dangling `*By` reference columns and working group-meeting pruning; verified by test. **Remaining:** the AI review path still mutates report state and consumes quota before the fallible Gemini call.
7. **Decide the plagiarism question** — build it or descope it and remove the public claim from the landing page. *(Still open — a product decision, not a code change.)*
8. ~~*(Added 2026-09-14)* **Enable `STRICT_TRANS_TABLES`**~~ **DONE 2026-09-14** — set per connection in `config/db.js`, scoped to this application so other databases on the same MariaDB instance are unaffected (`DB_STRICT_MODE=false` opts out). Over-length values are now rejected; twelve write paths across all four roles verified unaffected.
9. ~~*(Added 2026-09-14)* **Audit JSON column handling**~~ **DONE 2026-09-14** — normalised centrally via a global `afterFind` hook in `config/db.js`, rather than patching each consumer.
10. *(Added 2026-09-14)* **Add the six missing foreign keys to the live database** — a fresh schema has 13 FKs, the running `internsmart` database has only 7, since `sync({ force: false })` never alters existing tables. This needs a deliberate migration against production data, so it has not been done automatically.

### P1 — Requirement compliance
8. Declare `onDelete` policies / real foreign keys (`NFR-REL-01`).
9. Enforce a 20-point cap and rubric validation server-side; compute a composite grade; persist rubric feedback (`FR-GRD-01..03`).
10. Add the pre-grading integrity guard once `FR-PLAG-09` is scoped.
11. ~~Apply the 10 MB cap and exact-MIME validation to the AI upload path; add the missing `authorize` guard on `/api/ai/*` (`NFR-SEC-03`, `-04`).~~ **DONE 2026-09-14** — the AI uploader is now 10 MB with an exact MIME check and returns 413 when over the limit; the student report uploader requires MIME as well as extension; and `/api/ai/*` is restricted to the three non-admin roles. **Remaining:** the CSV uploader still accepts `text/csv` or any `.csv` filename, and there is no script-header stripping anywhere.
12. Complete pagination coverage and clamp the `limit` parameter (`NFR-PERF-05`).
13. Adopt the error envelope or formally replace `NFR-MNT-04`.
14. Implement the student defence-alert banner (`FR-TIM-03`).
15. Add code-splitting to address `NFR-PERF-04`.

### P2 — Hardening & consistency
16. Remove or implement the 15 empty files; delete the dead router and unwired routes.
17. Align CSV headers with the documented contract, or document the real nine-column schema (`FR-ADM-04`).
18. Fix group-meeting visibility for students and the hardcoded `localhost:3000` PDF link (`FR-MTG-04`, `FR-SUP-02`).
19. Unify the duplicated academic meeting APIs and their divergent validation.
20. Define `--primary` and either use `Outfit` or amend the typography requirement; add ≤ 375 px and 1920 px+ handling (`NFR-USA-01`, `-02`).
21. Validate `NFR-PERF-01..04` on a running deployment once P0 is complete.

---

## 6.10 Audit Method & Limitations

- **Method:** static analysis of routes, controllers, models, middleware, services, utilities, client components, CSS, configuration and dependency manifests, plus a read-only inspection of the existing `client/dist` build artefact.
- **Not performed:** no server was left running, no database migration was executed, no external API was called, and **no functional behaviour was verified at runtime**. One short-lived boot probe was used solely to confirm that module resolution currently succeeds; the process was terminated and its temporary output removed.
- **Therefore:** every "Implemented" verdict means the code path **exists and is wired as described**, not that it has been observed working against a live database. Requirement verdicts for runtime targets are explicitly marked *Not Verifiable Statically*.
- **Environment note:** at audit time some module resolution depended on a stray `C:\Users\simeb\node_modules` outside the repository. The `sequelize` case was fixed on 2026-09-14 — see the remediation log below.

---

## 6.11 Environment Remediation Log

Work performed after the audit, so the status labels above can be reconciled with the current state of the machine.

### 2026-09-14 — Database server repaired and launched

The bundled XAMPP MariaDB instance would not start. Root causes and fixes, in dependency order:

| # | Problem found | Action taken | Result |
| :-- | :--- | :--- | :--- |
| 1 | Stale Aria redo logs — `Aria recovery failed` | Removed `aria_log.00000001` and `aria_log_control` (MariaDB's own recommended fix) | Aria engine initialised |
| 2 | `mysql.db` / `mysql.columns_priv` corrupt (wrong CRC, rows lost) | `aria_chk -r -f -f --sort_buffer_size=256M` across the `mysql` schema (the first attempt failed because the default sort buffer is 16 KB) | Repaired |
| 3 | `mysql.proxies_priv` marked crashed; `help_topic` also unrepairable | Started with `--skip-grant-tables`, dropped and recreated both tables from the official definitions in `mysql_system_tables.sql`, re-inserted the default root proxy grant, restarted normally | Both report `CHECK TABLE` = OK |
| 4 | `mysqldump` rejected an option inherited from XAMPP's `my.ini` | Re-ran with `--no-defaults` | Logical dump of `internsmart` captured |

**Safety measures.** The entire data directory was copied to `C:\xampp\mysql\data-backup-20260914\` (202 files, 93.9 MB, size-verified) **before** any repair, and the original Aria log files are preserved there. All 24 Aria tables were confined to the `mysql` system schema — **no user database used Aria** — so user data was never exposed to the repair. The nine other databases (`ba2a`, `ecommerce_db`, `feedback_platform`, `ifly`, `phppro`, `shopify`, `test`, `phpmyadmin`, `internsmart`) were confirmed reachable afterwards, and `internsmart` was separately dumped to `internsmart-dump-before-seed.sql` prior to schema changes.

**Outcome.** MariaDB 10.4.32 running on port 3306 and reporting `ready for connections`. The `internsmart` schema was brought current through the application's own `ensure*Columns()` + `sequelize.sync()` startup path — no hand-written DDL. End-to-end authentication was verified by a live `POST /api/users/login` returning a valid JWT for the administrator account.

**Seeding outcome.** The database was found to already contain **real records** (7 users including 2 administrators, 3 students, 2 internships, plus reports, tasks, meetings, notifications and timeline settings), so **no synthetic rows were inserted**. The database was therefore *recovered* rather than *seeded*; a demo dataset remains available on request.

### 2026-09-14 — `sequelize` dependency declared

`sequelize ^6.37.8` added to `server/package.json` and installed into `server/node_modules`, recorded in `package-lock.json`. The out-of-project copy at `C:\Users\simeb\node_modules\sequelize` was **left in place** — that directory holds 105 packages that may serve other work — but is no longer required by this project, verified by booting the API with it temporarily hidden.

### 2026-09-14 — P0 correctness pass (second remediation)

Six of the seven P0 items were completed and verified. All functional testing ran against a **throwaway scratch database** (`internsmart_scratch`), which was created and dropped afterwards, so no test touched production rows — the real `internsmart` database was confirmed identical before and after (7 users, 3 students, 2 internships, 1 report, 1 task, 2 meetings, 4 notifications, 2 timeline settings).

| Fix | Verification |
| :--- | :--- |
| Case-sensitivity | `authController.js` import corrected. A sweep of **308 relative imports across 132 files** found this to be the only mismatch. |
| Password routes | `passwordRoutes.js` now uses named imports. Verified: `/forgot-password` → 200; `/change-password` without a token → 401. |
| First-login screen | `ChangePassword.jsx` renders from `passwordRequirements`, so the undefined `passwordRules` reference is gone. |
| Env-driven config | `db.js`, `server.js`, `axios.js` and `sendEmail.js` read the environment; `.env` gained `PORT`, `DB_PORT`, `CLIENT_URL`. Proven live by running the whole test suite against a different database via `DB_NAME`. |
| Transactions | `deleteUser` runs in one transaction; each CSV row runs in its own. Verified: failure forced *after* `User.create` → 0 rows after rollback and 1 after commit; deleting a seeded student cleared all eight dependent tables with zero orphans. |
| Dangling references | `Task.feedbackAcademicBy`/`feedbackProfessionalBy` and `Internship.academicGradeSubmittedBy`/`professionalGradeSubmittedBy` are nulled on deletion (verified with a task deliberately owned by a different supervisor). |
| Fresh-database bootstrap | `sequelize.sync()` now runs before the `ensure*Columns()` helpers; an empty database bootstrapped to 10 tables. |
| Group-meeting pruning | Root cause identified (MariaDB returns JSON columns as strings, so `Array.isArray()` was always false) and fixed; verified the group meeting is destroyed when its last member is deleted. |

Also verified after the changes: admin login returns a valid JWT, and all eleven `/api/admin/*` read endpoints return 200.

**Not done, deliberately:** the plagiarism decision and the OTP reset flow are product decisions rather than code fixes.

### 2026-09-14 — Correctness pass 3 (AI path, JSON columns, strict SQL mode)

Testing again used a throwaway `internsmart_scratch` database, created and dropped around the work; the live `internsmart` database was confirmed unchanged (7 users / 3 students / 2 internships / 1 report / 1 task / 2 meetings) before and after.

| Fix | Verification |
| :--- | :--- |
| **AI path compensation** | PDF extraction moved *before* any state change; the report's prior status/progress is captured and restored on failure; the daily request is refunded through a new `refundAiRequest`. Applied to `/api/students/reports/:id/send-to-ai`, `/api/ai/review` and the writing assistant. Verified two ways: an unreadable PDF now returns 200 with *"No AI request was used"* and leaves the report untouched; an invalid API key produced a 6.8 s failure after which the report was back to `submitted`/0 and the quota had gone 1 → 2 → 1. |
| **AI quota constant** | The writing-assistant fallback no longer returns a hardcoded limit of 3, which contradicted `AI_DAILY_LIMIT` (5). |
| **JSON columns** | A global `afterFind` hook in `config/db.js` parses JSON attributes that arrive as strings. Before: `aiAnalysis.metrics` was `undefined`, so an existing 18-suggestion review could not be rendered by the UI. After: `metrics.structure` = 75, `suggestions.length` = 18, and `documentContent` arrives as a real `{type:'doc'}` object. |
| **Strict SQL mode** | `STRICT_TRANS_TABLES` is set per connection, scoped to this app. Before: a 300-character matricule was stored silently truncated. After: rejected. Twelve write paths across all four roles still pass, as does CSV import. |
| **JSON round-trip** | A real PDF upload produced a v2 report whose `documentContent` persisted and returned as an object. |

**Side effect worth recording:** the AI pipeline was exercised once against the live Gemini API during testing and **works end-to-end** — a genuine review (overall 42/100, 25 suggestions, ~14.9 KB of analysis persisted). That consumed one request of the account's quota; all subsequent failure-path testing used an invalid key to avoid further usage.

**Correction to the earlier audit:** the claim that the schema has *no* foreign keys was wrong. Sequelize infers `references` from associations, so a freshly synced schema carries **13** FK constraints; the live database carries **7**, because `sync({ force: false })` never alters existing tables. `NFR-REL-01` is therefore **Partial**, not Missing, and §6.9 item 10 records the six that are missing from the running database.

### 2026-09-14 — Correctness pass 4 (password recovery, upload hardening)

**Password recovery — the last user-facing dead end — is now implemented** (`FR-AUTH-04..06`), replacing a stub that promised an email it never sent.

| Property | Implementation |
| :--- | :--- |
| Code generation | `crypto.randomInt(100000, 1000000)` — CSPRNG, 6 digits, no leading-zero bias |
| Storage | Only a **bcrypt hash** is kept in `otpCode`; the plaintext code exists solely in the email |
| Expiry | 15 minutes (`otpExpires`) |
| Brute-force control | 5 attempts (`otpAttempts`), then **429** and the code is destroyed; bcrypt cost also makes guessing slow |
| Reset token | JWT signed with a secret **derived** from `JWT_SECRET`, 15-minute life, `purpose` claim, single-use (cleared by a successful reset) |
| Enumeration | `/forgot-password` returns an identical 200 for unknown, inactive and undeliverable addresses; delivery failures are logged, never surfaced |
| Cross-use | A reset token cannot authenticate, and an access token cannot reset a password |

Verified on a scratch database: a wrong code decrements the allowance and the 6th attempt returns 429; an expired code returns 400 and is invalidated; a 5-digit code is rejected; weak and mismatched passwords are rejected; a valid reset lets the **new** password log in while the **old** one returns 401; a replayed token returns 400; and both cross-use directions return 401. The `otpCode`/`otpExpires`/`otpAttempts` columns were then migrated onto the **live** database (7 users intact, login unaffected). `ForgotPassword.jsx` was rebuilt as a real three-step flow.

**Upload hardening** (`NFR-SEC-03`, `NFR-SEC-04`): the AI uploader dropped from **20 MB to the specified 10 MB**; the student uploader now requires the declared `application/pdf` MIME type as well as the `.pdf` extension; Multer limit errors return **413** with a readable message instead of an opaque 500; and `/api/ai/*` is role-guarded. Verified: 11 MB → 413, non-PDF → 400, `text/plain` named `.pdf` → 400, valid PDF → accepted, admin → 403 on AI routes, anonymous → 401. Both requirements were re-graded (`NFR-SEC-03` → Implemented).

### Still open

Password recovery is closed. What remains is: **the plagiarism decision** (build or formally descope the landing-page claim); the **six foreign keys missing from the live database**; **grade-composite arithmetic** (`FR-GRD-01`); **CSV MIME-vs-filename leniency** and the absence of **script-header stripping** (`NFR-SEC-04`); the **standardised error envelope** (`NFR-MNT-04` — 0 of ~314 handlers comply); **real-time delivery** (Socket.IO declared but never initialised); **code-splitting** for the 2 MB bundle (`NFR-PERF-04`); and **all four runtime performance targets**.
