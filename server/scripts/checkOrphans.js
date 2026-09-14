import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import Task from "../models/taskModel.js";
import DefenseAlert from "../models/defenseAlertModel.js";
import ReportComment from "../models/reportCommentModel.js";
import "../models/association.js";

async function check() {
  try {
    sequelize.options.logging = false;
    await sequelize.authenticate();
    
    const users = await User.findAll({ raw: true });
    const userIds = new Set(users.map(u => u.id));
    console.log(`TOTAL USERS IN DB: ${users.length}`);
    console.log("Users:", users.map(u => `${u.id}:${u.name}(${u.role})`).join(", "));

    const students = await Student.findAll({ raw: true });
    console.log(`\nTOTAL STUDENTS IN DB: ${students.length}`);
    const orphanedStudents = students.filter(s => !userIds.has(s.userId));
    console.log(`ORPHANED STUDENTS (userId not in Users): ${orphanedStudents.length}`);
    orphanedStudents.forEach(s => console.log(`  - Student ID: ${s.id}, userId: ${s.userId}, matricule: ${s.matricule}`));

    const studentIds = new Set(students.filter(s => userIds.has(s.userId)).map(s => s.id));

    const internships = await Internship.findAll({ raw: true });
    console.log(`\nTOTAL INTERNSHIPS: ${internships.length}`);
    const orphanedInternships = internships.filter(i => 
      !studentIds.has(i.studentId) ||
      (i.academicSupervisorId && !userIds.has(i.academicSupervisorId)) ||
      (i.professionalSupervisorId && !userIds.has(i.professionalSupervisorId))
    );
    console.log(`ORPHANED/INVALID INTERNSHIPS: ${orphanedInternships.length}`);
    orphanedInternships.forEach(i => console.log(`  - Internship ID: ${i.id}, studentId: ${i.studentId}, acadSupId: ${i.academicSupervisorId}, profSupId: ${i.professionalSupervisorId}`));

    const reports = await Report.findAll({ raw: true });
    console.log(`\nTOTAL REPORTS: ${reports.length}`);
    const orphanedReports = reports.filter(r => !studentIds.has(r.studentId));
    console.log(`ORPHANED REPORTS: ${orphanedReports.length}`);
    orphanedReports.forEach(r => console.log(`  - Report ID: ${r.id}, studentId: ${r.studentId}, title: ${r.title}`));

    const meetings = await Meeting.findAll({ raw: true });
    console.log(`\nTOTAL MEETINGS: ${meetings.length}`);
    const orphanedMeetings = meetings.filter(m => 
      (m.studentId && !studentIds.has(m.studentId)) ||
      (m.createdBy && !userIds.has(m.createdBy))
    );
    console.log(`ORPHANED MEETINGS: ${orphanedMeetings.length}`);
    orphanedMeetings.forEach(m => console.log(`  - Meeting ID: ${m.id}, studentId: ${m.studentId}, createdBy: ${m.createdBy}`));

    const tasks = await Task.findAll({ raw: true });
    console.log(`\nTOTAL TASKS: ${tasks.length}`);
    const orphanedTasks = tasks.filter(t => 
      !studentIds.has(t.studentId) ||
      (t.supervisorId && !userIds.has(t.supervisorId))
    );
    console.log(`ORPHANED TASKS: ${orphanedTasks.length}`);
    orphanedTasks.forEach(t => console.log(`  - Task ID: ${t.id}, studentId: ${t.studentId}, supervisorId: ${t.supervisorId}`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sequelize.close();
  }
}

check();
