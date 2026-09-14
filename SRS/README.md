# InternSmart — Software Requirements Specification (SRS)

**Version 2.1.0 — As-Built Edition · 2026-09-14**

Requirements specification for **InternSmart**, an internship management, report-writing and evaluation platform for higher-education institutions, connecting **Students**, **Academic Supervisors**, **Professional (Company) Supervisors**, and **System Administrators**.

> **What this version is.** v2.0.0 was a forward-looking specification. This v2.1.0 edition was produced from a static audit of the actual repository and aligns every requirement with the delivered system. Requirements that are **not** built are retained, but explicitly marked as roadmap rather than described as existing behaviour. Every verdict in this suite is traceable to code via a `file:line` reference. The v2.0.0 text is preserved at [`archive/v2.0/`](./archive/v2.0/).

---

## 📖 How to Read This Suite

Each requirement carries a **Status** field:

| Status | Meaning |
| :--- | :--- |
| **Implemented** | End-to-end behaviour exists: route + logic + persistence and/or UI, as applicable. |
| **Partial** | Some layers exist; behaviour is incomplete, stubbed, path-mismatched, or broken. |
| **Missing (Roadmap)** | Specified but not present in the codebase. Retained as design intent, not a claim. |
| **Not Verifiable Statically** | A measurable runtime target (latency, load) that cannot be confirmed without executing the system. |

Coverage is summarised in **[06. Implementation Status & Roadmap](./06_IMPLEMENTATION_STATUS_AND_ROADMAP.md)**, which also registers dead code and documentation drift.

---

## 📚 Document Suite

### [01. Introduction and Scope](./01_INTRODUCTION_AND_SCOPE.md)
Purpose, the six operational pillars with delivery status, target audience, terminology, and the **as-built** technical foundation.

### [02. General Description](./02_GENERAL_DESCRIPTION.md)
Product perspective, the four user roles and their real capabilities, operating environment, design constraints, assumptions and dependencies.

### [03. System Architecture & Tech Stack](./03_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md)
Decoupled client-server architecture, the **actual** dependency versions, the real database schema for all 10 persisted entities, and an inventory of the live REST API surface.

### [04. Functional Requirements](./04_FUNCTIONAL_REQUIREMENTS.md)
`FR-AUTH`, `FR-STU`, `FR-AI`, `FR-PLAG`, `FR-SUP`, `FR-PSUP`, `FR-MTG`, `FR-TSK`, `FR-GRD`, `FR-ADM`, `FR-TIM` — each with status and evidence.

### [05. Non-Functional Requirements](./05_NON_FUNCTIONAL_REQUIREMENTS.md)
`NFR-PERF`, `NFR-SEC`, `NFR-REL`, `NFR-USA`, `NFR-MNT` — each with status and evidence.

### [06. Implementation Status & Roadmap](./06_IMPLEMENTATION_STATUS_AND_ROADMAP.md)
Audited coverage scorecard, highest-risk defects, dead-code register, documentation-drift register, and a prioritised remediation roadmap.

---

## 🔑 Headline Findings (v2.1)

1. **Report writing, supervision, task tracking, meetings, grading and administration are delivered** as working end-to-end features.
2. **The Internal Academic Plagiarism Detection Engine — the flagship of v2.0 — is not implemented.** No models, routes, algorithms, admin configuration, or supervisor UI exist; `server/services/plagiarismService.js` is a 0-byte placeholder. See `FR-PLAG-01..11`.
3. ~~**The OTP password-recovery flow is not implemented.**~~ **Implemented 2026-09-14** — a full three-step flow now exists (request a 6-digit code by email, verify it, set a new password), with the code stored only as a bcrypt hash, a 15-minute expiry, a 5-attempt cap, single-use reset tokens, and neutral responses that never reveal whether an address has an account. See `FR-AUTH-04..06`.
4. **The v2.0 technology stack was out of date.** The client runs React 19, React Router 7, Vite 8 and Tailwind 4 — not React 18 / Router 6 as previously specified.
5. **Documented API paths and data-model fields did not match the code.** Examples: the account flag is `active` (not `isBlocked`), no `otpCode`/`otpExpires` columns exist, password endpoints live under `/api/users`, and `reports.documentContent` is JSON (not LONGTEXT).
6. **15 source files in the repository are entirely empty**, several of them named by v2.0 as real components.

---

## 📌 Revision History & Document Control

| Version | Date | Summary of Changes | Status |
| :--- | :--- | :--- | :--- |
| **1.0.0** | Aug 2026 | Initial baseline specification. | Superseded |
| **1.1.0** | Sep 2026 | Added Jitsi Meet meeting dispatch and cascading user cleanup. | Superseded |
| **2.0.0** | Sep 2026 | "Enterprise Edition": added the Internal Plagiarism Detection Engine, three plagiarism entities, and NFR benchmarks. | Superseded (aspirational) |
| **2.1.0** | 2026-09-14 | **As-Built Edition.** Aligned every requirement with a static audit of the repository: corrected the technology stack, entity list and API paths; added per-requirement Status and `file:line` evidence; reclassified unbuilt features (plagiarism engine, OTP recovery) as roadmap; added the implementation-status, dead-code and drift registers. | **Current** |

### Method & Scope of the v2.1 Audit

- **Method:** static analysis — reading routes, controllers, models, middleware, services, client components and dependency manifests. No runtime execution, no database migration, no external API calls.
- **Excluded from verdicts:** anything requiring a running server, a live database, or a measurement (see *Not Verifiable Statically*).
- **Basis:** repository state as of 2026-09-14 (last commit `77420df`, 2026-09-11).
