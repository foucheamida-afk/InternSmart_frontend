# 01. Introduction and Scope

## 1.1 Purpose
This Software Requirements Specification (SRS) document provides a formal, comprehensive description of the functional, non-functional, and structural specifications for **InternSmart** — an enterprise-grade AI-Powered Internship Management & Report Writing Platform with Integrated Academic Plagiarism Detection.

InternSmart acts as the institutional single source of truth for managing university internship lifecycles. It seamlessly connects four primary user roles — **Students**, **Academic Supervisors**, **Professional (Company) Supervisors**, and **System Administrators** — into a unified, secure collaborative workspace. The platform incorporates automated artificial intelligence (AI) report auditing via Google Gemini, real-time WebRTC video conferencing via Jitsi Meet, normalized dual-evaluations, and an in-house **Internal Academic Plagiarism Detection Engine** designed to safeguard institutional integrity and streamline academic supervision.

---

## 1.2 Scope & Objective

Traditional university internship programs face multiple operational inefficiencies: disconnected communications, manual report reviews, lack of real-time student tracking, inconsistent workplace feedback, and unverified academic report integrity. InternSmart solves these challenges through six core operational pillars:

1. **Centralized Academic Communication & Task Tracking:** Replaces fragmented email threads with dedicated in-app task assignments, progress submission workflows, real-time notifications, and scheduled video conferences.
2. **AI-Powered Report Writing Workspace & Error Inspector:** Provides students with a rich interactive editor and PDF report upload facility. Integrates Google Gemini API to deliver instant structural analysis, grammatical audits, technical depth evaluation, and actionable section-by-section writing corrections.
3. **Internal Academic Plagiarism Detection Engine:** Features an automated, multi-stage similarity detection algorithm that compares newly submitted report drafts against an internal institutional database repository of past and concurrent student reports. The engine detects direct text matches, n-gram overlap, structural duplication, and semantic paraphrasing, presenting Academic Supervisors with side-by-side inspection tools and matched source attributions.
4. **Normalized Dual-Supervisor Evaluation System:** Establishes a formal evaluation framework that splits grading responsibility between Academic Supervisors (academic rigor, report structure, defense presentation out of 20 points) and Professional Supervisors (workplace execution, technical mastery, soft skills out of 10 points).
5. **Integrated WebRTC Video Conferencing:** Enables single-click creation and launching of virtual check-ins and defense prep meetings via Jitsi Meet, automatically notifying student participants with direct join links.
6. **Administrative Governance, CSV Onboarding & Cascading Data Integrity:** Equips System Administrators with tools for bulk student CSV onboarding, institutional timeline phase configuration, global defense alert broadcasts, and automated database cascading cleanup routines to preserve total database integrity upon user deletion.

---

## 1.3 Target Audience

This document is designed for the following institutional stakeholders and technical personnel:

- **Software Engineers & System Architects:** For implementing backend REST services, database ORM models, similarity detection algorithms, frontend React components, and external service integrations.
- **Academic Supervisors & Faculty Department Heads:** For understanding platform grading rubrics, plagiarism detection thresholds, report audit workflows, and supervision capabilities.
- **System Administrators & IT Operations:** For configuring user accounts, processing CSV imports, managing database maintenance, monitoring AI quotas, and setting plagiarism parameters.
- **Quality Assurance & Testing Teams:** For deriving test cases, validating non-functional performance benchmarks, and verifying role-based access security.

---

## 1.4 Definitions, Acronyms, and Abbreviations

| Term / Acronym | Definition |
| :--- | :--- |
| **SRS** | Software Requirements Specification |
| **JWT** | JSON Web Token — Standard compact format for transmitting secure, signed user authorization tokens |
| **OTP** | One-Time Password — 6-digit temporal numeric security key dispatched via email for password verification |
| **ORM** | Object-Relational Mapping — Software layer (Sequelize) mapping relational tables to JavaScript models |
| **API** | Application Programming Interface |
| **AI** | Artificial Intelligence — Specifically Google Gemini 2.5 API for document analysis and structural feedback |
| **Jitsi Meet** | WebRTC-based open-source video conferencing technology framework |
| **CSV** | Comma-Separated Values — Standard tabular text data format used for administrative bulk imports |
| **Plagiarism Engine** | Internal algorithm suite calculating textual similarity between submitted documents and stored institutional repository records |
| **Similarity Index (SI)** | Percentage (0% to 100%) indicating the proportion of a submitted report text matching existing internal repository documents |
| **N-Gram** | A contiguous sequence of *n* items (words or characters) extracted from text used for fast similarity fingerprinting |
| **TF-IDF** | Term Frequency-Inverse Document Frequency — Statistical metric evaluating word importance across a document collection |
| **Cosine Similarity** | Mathematical metric measuring the cosine of the angle between two multi-dimensional text feature vectors |
| **LSH** | Locality-Sensitive Hashing — High-performance probabilistic hashing algorithm used for instant candidate match retrieval |
| **Corpus** | The institutional database collection of past and active student internship reports used as reference baseline |

---

## 1.5 Project Overview & Technical Foundation

InternSmart is engineered around a modern, scalable, decoupled web architecture comprising:
- **Client Tier:** React 18 Single-Page Application (SPA) powered by Vite, featuring a customized dark glassmorphism design system, Lucide icons, responsive layout utilities, and Axios request interceptors.
- **Application Tier:** Node.js (v18+/v20+ LTS) running Express 5.x framework, utilizing ES Modules, JWT authorization middleware, Multer file processing, and asynchronous background job processors.
- **Data & Storage Tier:** Relational SQL database (MySQL 8.0+ / PostgreSQL 14+) managed via Sequelize ORM with strictly configured foreign keys and cascading deletion rules, alongside local filesystem storage for uploaded PDF assets.
- **Integration Layer:** Google Gemini AI API (`@google/genai`), Jitsi Meet public WebRTC gateway (`meet.jit.si`), and SMTP email services (`nodemailer`).
