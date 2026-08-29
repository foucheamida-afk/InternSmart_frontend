import User from "./userModel.js";
import Student from "./studentModel.js";
import Internship from "./studentAssignmentModel.js";
import Report from "./reportModel.js";
import Meeting from "./meetingModel.js";
import Notification from "./notificationModel.js";
import DefenseAlert from "./defenseAlertModel.js";
import Task from "./taskModel.js";

// User → Student
User.hasOne(Student, {
  foreignKey: "userId",
  as: "studentProfile",
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

// Student → Reports
Student.hasMany(Report, {
  foreignKey: "studentId",
  as: "reports",
});

Report.belongsTo(Student, {
  foreignKey: "studentId",
  as: "student",
});

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
};

export default Internship;
