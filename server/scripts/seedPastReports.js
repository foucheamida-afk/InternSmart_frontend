import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import { ensureIndexed } from "../services/plagiarism/internalProvider.js";

const REPORTS_DATA = [
  {
    title: "Design and Implementation of a High-Throughput Distributed Telemetry Pipeline",
    academicYear: "2023/2024",
    studentName: "Alexandre Mbarga",
    matricule: "HIST-2023-001",
    program: "Computer Science",
    classLevel: "CS Level 400",
    companyName: "Acme Systems Research Labs",
    domain: "Distributed Systems",
    abstract: "This internship report details the architectural design, implementation, and performance benchmarking of an event-driven telemetry ingestion system utilizing Apache Kafka and microservice architecture. The platform reliably handles 40,000 events/sec with bounded latency and high availability across distributed nodes.",
    keywords: ["distributed systems", "telemetry", "kafka", "microservices", "streaming"],
    paragraphs: [
      "The internship was carried out at Acme Systems Research Labs where the primary objective involved designing and implementing a distributed telemetry pipeline capable of ingesting roughly forty thousand events per second while maintaining a bounded end to end latency budget across three availability zones.",
      "The pipeline was decomposed into an ingestion tier a normalisation tier and a durable append only storage tier. Each tier was independently scalable and communicated exclusively through a partitioned commit log which allowed replay of historical traffic for regression testing and deterministic reproduction of production incidents.",
      "Particular attention was paid to backpressure because unbounded queue growth during a downstream outage was identified as the dominant failure mode in the legacy system and a credit based flow control scheme was adopted."
    ]
  },
  {
    title: "Building Scalable E-Commerce Microservices with React and Node.js",
    academicYear: "2023/2024",
    studentName: "Béatrice Ngo Som",
    matricule: "HIST-2023-002",
    program: "Software Engineering",
    classLevel: "SE Level 400",
    companyName: "Fintech & Retail Solutions",
    domain: "Software Engineering",
    abstract: "Comprehensive analysis and development of a modern multi-tenant e-commerce platform incorporating secure payment gateway integrations, session caching with Redis, containerized deployment via Docker, and responsive React frontend components.",
    keywords: ["e-commerce", "react", "node.js", "microservices", "redis", "docker"],
    paragraphs: [
      "During this internship at Fintech & Retail Solutions, I engineered a high-concurrency shopping backend utilizing Express.js microservices and Redis session caches.",
      "The front-end client was built using React with atomic component design, state management via Context API, and optimistic UI updates for quick user feedback during checkout operations.",
      "Security standards were strictly maintained with JWT authentication tokens, bcrypt password hashing, input sanitization, and automated CSRF validation middleware."
    ]
  },
  {
    title: "Automated Document Fingerprinting and Plagiarism Detection in Academic Reports",
    academicYear: "2024/2025",
    studentName: "Cedric Fossi",
    matricule: "HIST-2024-003",
    program: "Data Science & Artificial Intelligence",
    classLevel: "DS Level 400",
    companyName: "InternSmart AI Innovation Center",
    domain: "Artificial Intelligence",
    abstract: "Investigation into n-gram shingling, Jaccard similarity indexing, and NLP-based document hashing for real-time similarity checks across historical academic internship submissions and online sources.",
    keywords: ["plagiarism", "nlp", "shingling", "jaccard similarity", "machine learning"],
    paragraphs: [
      "This project focused on constructing an internal document fingerprinting algorithm designed to catch cross-cohort report reuse in academic institutions.",
      "By tokenizing text into 5-word shingles and generating MinHash signatures, the engine can screen hundreds of candidate documents in milliseconds.",
      "Evaluation against synthetic copied reports demonstrated a 98.4% detection accuracy while eliminating false positives caused by standard cover pages and institutional headers."
    ]
  },
  {
    title: "Cloud Infrastructure Automation and CI/CD Pipeline Optimization",
    academicYear: "2023/2024",
    studentName: "Diana Etoa",
    matricule: "HIST-2023-004",
    program: "Cloud Computing & DevOps",
    classLevel: "CC Level 400",
    companyName: "CloudNet Global Infrastructure",
    domain: "DevOps & Cloud Computing",
    abstract: "Implementation of automated infrastructure provisioning using Terraform and Ansible, coupled with Kubernetes cluster telemetry and Prometheus metrics alerting to improve deployment velocity.",
    keywords: ["kubernetes", "terraform", "devops", "ci/cd", "cloud infrastructure"],
    paragraphs: [
      "At CloudNet Global, I assisted the cloud architecture team in migrating legacy monolithic deployments to automated Kubernetes clusters.",
      "Infrastructure-as-Code (IaC) templates were created in Terraform to provision multi-node AWS clusters, VPC networks, and IAM role access controls.",
      "CI/CD integration using GitHub Actions reduced release cycle duration from 45 minutes to under 6 minutes with automated rollbacks on health check failures."
    ]
  },
  {
    title: "Enterprise Vulnerability Assessment and Security Audit Automation",
    academicYear: "2024/2025",
    studentName: "Emmanuel Nsangou",
    matricule: "HIST-2024-005",
    program: "Cybersecurity & Information Assurance",
    classLevel: "CSec Level 400",
    companyName: "SecureCorp Cyber Security",
    domain: "Cybersecurity",
    abstract: "A study on conducting automated static and dynamic application security testing (SAST/DAST), identifying OWASP Top 10 vulnerabilities, and securing RESTful API endpoints in banking systems.",
    keywords: ["cybersecurity", "sast", "owasp", "api security", "penetration testing"],
    paragraphs: [
      "The primary focus of this security engineering internship was performing risk assessments and automated vulnerability scans across web applications.",
      "Using SonarQube and OWASP ZAP, we identified critical flaws such as SQL injection risks, exposed API tokens, and missing security headers.",
      "Remediation guidelines were implemented including parameterized queries, strict CORS configuration, rate limiting, and automated security pipeline gates."
    ]
  },
  {
    title: "Cross-Platform Mobile Application with Offline-First Data Synchronization",
    academicYear: "2024/2025",
    studentName: "Fatima Kouamé",
    matricule: "HIST-2024-006",
    program: "Mobile Computing & Software Engineering",
    classLevel: "SE Level 400",
    companyName: "NextGen Mobile Solutions",
    domain: "Mobile Development",
    abstract: "Development of a Flutter-based mobile application utilizing SQLite local storage and background sync protocols for low-connectivity environments in field operational tracking.",
    keywords: ["flutter", "mobile", "offline-first", "sqlite", "data synchronization"],
    paragraphs: [
      "Field operations often occur in environments with spotty internet connectivity, creating data loss risks for operational tracking systems.",
      "We engineered a Flutter mobile app backed by an offline-first architecture using SQLite storage and a queue-based sync engine.",
      "When network connection is restored, background workers automatically reconcile local changes with the central REST API using exponential backoff retry strategies."
    ]
  }
];

const TREE = (paragraphs) => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
});

async function seedPastReports() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database...");

    const passwordHash = await bcrypt.hash("Password123!", 10);
    let seededCount = 0;

    for (const data of REPORTS_DATA) {
      // Check if entry already exists by title
      const existingEntry = await LibraryEntry.findOne({ where: { title: data.title } });
      if (existingEntry) {
        console.log(`Report already exists in library: "${data.title}"`);
        continue;
      }

      const email = `past_student_${data.matricule.toLowerCase()}@example.invalid`;

      // 1. User
      const user = await User.create({
        name: data.studentName,
        email,
        password: passwordHash,
        role: "student",
        mustChangePassword: false,
        active: true,
      });

      // 2. Student Profile
      const student = await Student.create({
        userId: user.id,
        matricule: data.matricule,
        class: data.classLevel,
      });

      // 3. Internship Record
      await Internship.create({
        studentId: student.id,
        company: data.companyName,
        academicYear: data.academicYear,
        program: data.program,
        internshipDomain: data.domain,
      });

      // 4. Report & Version
      const report = await Report.create({
        studentId: student.id,
        title: data.title,
        fileName: `${data.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        fileUrl: `/uploads/sample_${data.matricule}.pdf`,
        status: "final_submitted",
        submittedAt: new Date(),
        documentContent: TREE(data.paragraphs),
      });

      const version = await ReportVersion.create({
        reportId: report.id,
        versionNumber: 1,
        fileName: report.fileName,
        fileUrl: report.fileUrl,
        fileHash: `hash-${report.id}-${Date.now()}`,
        extractedText: data.paragraphs.join("\n\n"),
      });

      await report.update({
        currentVersionId: version.id,
        lockedAt: new Date(),
        finalSubmittedAt: new Date(),
      });

      // 5. Library Entry
      const entry = await LibraryEntry.create({
        reportId: report.id,
        reportVersionId: version.id,
        studentId: student.id,
        title: report.title,
        abstract: data.abstract,
        keywords: data.keywords,
        academicYear: data.academicYear,
        program: data.program,
        classLevel: data.classLevel,
        companyName: data.companyName,
        internshipDomain: data.domain,
        submissionDate: new Date(),
        visibility: "institution",
      });

      // 6. Index text shingles for internal plagiarism comparisons
      await ensureIndexed(entry);

      seededCount++;
      console.log(`Seeded: "${data.title}" (${data.academicYear})`);
    }

    console.log("\n=======================================================");
    console.log(`SUCCESS: ${seededCount} PAST REPORTS SEEDED INTO THE LIBRARY!`);
    console.log("=======================================================\n");

  } catch (error) {
    console.error("SEEDING PAST REPORTS ERROR:", error);
  }
}

export default seedPastReports;

// Run directly if invoked from CLI
if (process.argv[1]?.includes('seedPastReports.js')) {
  seedPastReports().finally(() => sequelize.close());
}

