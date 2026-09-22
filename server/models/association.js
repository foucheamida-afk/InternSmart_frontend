import User from "./userModel.js";
import Student from "./studentModel.js";
import Internship from "./studentAssignmentModel.js";
import Report from "./reportModel.js";
import Meeting from "./meetingModel.js";
import Notification from "./notificationModel.js";
import DefenseAlert from "./defenseAlertModel.js";
import Task from "./taskModel.js";
import ReportComment from "./reportCommentModel.js";
import ReportVersion from "./reportVersionModel.js";
import ReportReview from "./reportReviewModel.js";
import ReportAudit from "./reportAuditModel.js";
import ReportSubmission from "./reportSubmissionModel.js";
import LibraryEntry from "./libraryEntryModel.js";
import PlagiarismAnalysis from "./plagiarismAnalysisModel.js";
import PlagiarismMatch from "./plagiarismMatchModel.js";

// User → Student
User.hasOne(Student, {
  foreignKey: "userId",
  as: "student",
});

Student.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Student → Internship
Student.hasOne(Internship, {
  foreignKey: "studentId",
  as: "internship",
});

Internship.belongsTo(Student, {
  foreignKey: "studentId",
  as: "student",
});

// Academic Supervisor → Internships
User.hasMany(Internship, {
  foreignKey: "academicSupervisorId",
  as: "academicInternships",
});

Internship.belongsTo(User, {
  foreignKey: "academicSupervisorId",
  as: "academicSupervisor",
});

// Professional Supervisor → Internships
User.hasMany(Internship, {
  foreignKey: "professionalSupervisorId",
  as: "professionalInternships",
});

Internship.belongsTo(User, {
  foreignKey: "professionalSupervisorId",
  as: "professionalSupervisor",
});

// Student → Reports
Student.hasMany(Report, {
  foreignKey: "studentId",
  as: "reports",
});

Report.belongsTo(Student, {
  foreignKey: "studentId",
  as: "student",
});

Report.hasMany(ReportComment, { foreignKey: "reportId", as: "comments" });
ReportComment.belongsTo(Report, { foreignKey: "reportId", as: "report" });
User.hasMany(ReportComment, { foreignKey: "userId", as: "reportComments" });
ReportComment.belongsTo(User, { foreignKey: "userId", as: "author" });

// Report → ReportVersion (immutable file history)
Report.hasMany(ReportVersion, { foreignKey: "reportId", as: "versions" });
ReportVersion.belongsTo(Report, { foreignKey: "reportId", as: "report" });

// Report / ReportVersion → ReportReview (one verdict per supervisor per cycle)
Report.hasMany(ReportReview, { foreignKey: "reportId", as: "reviews" });
ReportReview.belongsTo(Report, { foreignKey: "reportId", as: "report" });

ReportVersion.hasMany(ReportReview, { foreignKey: "reportVersionId", as: "reviews" });
ReportReview.belongsTo(ReportVersion, { foreignKey: "reportVersionId", as: "reportVersion" });

User.hasMany(ReportReview, { foreignKey: "supervisorId", as: "reportReviews" });
ReportReview.belongsTo(User, { foreignKey: "supervisorId", as: "supervisor" });

// Report → audit trail (append-only) and → final submissions
Report.hasMany(ReportAudit, { foreignKey: "reportId", as: "auditTrail" });
ReportAudit.belongsTo(Report, { foreignKey: "reportId", as: "report" });
ReportAudit.belongsTo(User, { foreignKey: "actorId", as: "actor" });

Report.hasMany(ReportSubmission, { foreignKey: "reportId", as: "submissions" });
ReportSubmission.belongsTo(Report, { foreignKey: "reportId", as: "report" });
ReportSubmission.belongsTo(ReportVersion, { foreignKey: "reportVersionId", as: "reportVersion" });
ReportSubmission.belongsTo(User, { foreignKey: "submittedBy", as: "submittedByUser" });

// Report / ReportVersion → LibraryEntry (the archived copy in the virtual library)
Report.hasMany(LibraryEntry, { foreignKey: "reportId", as: "libraryEntries" });
LibraryEntry.belongsTo(Report, { foreignKey: "reportId", as: "report" });

ReportVersion.hasOne(LibraryEntry, { foreignKey: "reportVersionId", as: "libraryEntry" });
LibraryEntry.belongsTo(ReportVersion, { foreignKey: "reportVersionId", as: "reportVersion" });

Student.hasMany(LibraryEntry, { foreignKey: "studentId", as: "libraryEntries" });
LibraryEntry.belongsTo(Student, { foreignKey: "studentId", as: "student" });

LibraryEntry.belongsTo(User, { foreignKey: "academicSupervisorId", as: "academicSupervisor" });
LibraryEntry.belongsTo(User, { foreignKey: "professionalSupervisorId", as: "professionalSupervisor" });

// Plagiarism analyses: one row per request, tied to the exact version analysed,
// with the matched sources beneath it.
PlagiarismAnalysis.hasMany(PlagiarismMatch, { foreignKey: "analysisId", as: "matches" });
PlagiarismMatch.belongsTo(PlagiarismAnalysis, { foreignKey: "analysisId", as: "analysis" });

Report.hasMany(PlagiarismAnalysis, { foreignKey: "reportId", as: "plagiarismAnalyses" });
PlagiarismAnalysis.belongsTo(Report, { foreignKey: "reportId", as: "report" });

ReportVersion.hasMany(PlagiarismAnalysis, { foreignKey: "reportVersionId", as: "plagiarismAnalyses" });
PlagiarismAnalysis.belongsTo(ReportVersion, { foreignKey: "reportVersionId", as: "reportVersion" });

LibraryEntry.hasMany(PlagiarismAnalysis, { foreignKey: "libraryEntryId", as: "plagiarismAnalyses" });
PlagiarismAnalysis.belongsTo(LibraryEntry, { foreignKey: "libraryEntryId", as: "libraryEntry" });

// User → Meetings (creator)
User.hasMany(Meeting, {
  foreignKey: "createdBy",
  as: "meetings",
});

Meeting.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});

// Student → Meetings
Student.hasMany(Meeting, {
  foreignKey: "studentId",
  as: "studentMeetings",
});

Meeting.belongsTo(Student, {
  foreignKey: "studentId",
  as: "meetingStudent",
});

// User → Notifications
User.hasMany(Notification, {
  foreignKey: "userId",
  as: "notifications",
});

Notification.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Student → DefenseAlerts
Student.hasMany(DefenseAlert, {
  foreignKey: "studentId",
  as: "defenseAlerts",
});

DefenseAlert.belongsTo(Student, {
  foreignKey: "studentId",
  as: "student",
});

// Student → Task
Student.hasMany(Task, { foreignKey: "studentId", as: "tasks" });
Task.belongsTo(Student, { foreignKey: "studentId", as: "student" });

// Supervisor → Task
User.hasMany(Task, { foreignKey: "supervisorId", as: "supervisedTasks" });
Task.belongsTo(User, { foreignKey: "supervisorId", as: "supervisor" });



export {
  User,
  Student,
  Internship,
  Report,
  Meeting,
  Notification,
  DefenseAlert,
  Task,
  ReportComment,
  ReportVersion,
  ReportReview,
  ReportAudit,
  ReportSubmission,
  LibraryEntry,
  PlagiarismAnalysis,
  PlagiarismMatch,
};

export default Internship;
