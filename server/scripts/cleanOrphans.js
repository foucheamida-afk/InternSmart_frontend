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

async function cleanOrphans() {
  try {
    sequelize.options.logging = false;
    await sequelize.authenticate();
    console.log("Database connected for orphan cleanup.");

    const users = await User.findAll();
    const validUserIds = new Set(users.map(u => u.id));
    console.log(`Active Users count on Admin Dashboard: ${users.length}`);
    users.forEach(u => console.log(` - User ID ${u.id}: ${u.name} (${u.role}) <${u.email}>`));

    // 1. Orphaned Students
    const allStudents = await Student.findAll();
    const orphanedStudents = allStudents.filter(s => !validUserIds.has(s.userId));
    console.log(`\nFound ${orphanedStudents.length} orphaned Student records (userId not in Users).`);

    for (const student of orphanedStudents) {
      console.log(`Removing orphaned Student ID ${student.id} (userId: ${student.userId}, matricule: ${student.matricule})...`);
      // Delete child records
      await Internship.destroy({ where: { studentId: student.id } });
      const reports = await Report.findAll({ where: { studentId: student.id } });
      for (const r of reports) {
        await ReportComment.destroy({ where: { reportId: r.id } });
      }
      await Report.destroy({ where: { studentId: student.id } });
      await Meeting.destroy({ where: { studentId: student.id } });
      await Task.destroy({ where: { studentId: student.id } });
      await DefenseAlert.destroy({ where: { studentId: student.id } });
      await student.destroy();
    }

    // Refresh valid student IDs
    const validStudents = await Student.findAll();
    const validStudentIds = new Set(validStudents.map(s => s.id));
    console.log(`Valid Students remaining: ${validStudents.length}`);

    // 2. Orphaned / Invalid Internships
    const allInternships = await Internship.findAll();
    for (const internship of allInternships) {
      if (!validStudentIds.has(internship.studentId)) {
        console.log(`Deleting internship ID ${internship.id} (studentId ${internship.studentId} no longer exists)...`);
        await internship.destroy();
      } else {
        let updated = false;
        if (internship.academicSupervisorId && !validUserIds.has(internship.academicSupervisorId)) {
          console.log(`Clearing non-existent academicSupervisorId ${internship.academicSupervisorId} from Internship ID ${internship.id}...`);
          internship.academicSupervisorId = null;
          updated = true;
        }
        if (internship.professionalSupervisorId && !validUserIds.has(internship.professionalSupervisorId)) {
          console.log(`Clearing non-existent professionalSupervisorId ${internship.professionalSupervisorId} from Internship ID ${internship.id}...`);
          internship.professionalSupervisorId = null;
          updated = true;
        }
        if (updated) {
          await internship.save();
        }
      }
    }

    // 3. Orphaned Reports
    const allReports = await Report.findAll();
    for (const report of allReports) {
      if (!validStudentIds.has(report.studentId)) {
        console.log(`Deleting report ID ${report.id} (studentId ${report.studentId} no longer exists)...`);
        await ReportComment.destroy({ where: { reportId: report.id } });
        await report.destroy();
      }
    }

    // 4. Orphaned ReportComments
    const allComments = await ReportComment.findAll();
    for (const comment of allComments) {
      if (!validUserIds.has(comment.userId)) {
        console.log(`Deleting ReportComment ID ${comment.id} (userId ${comment.userId} no longer exists)...`);
        await comment.destroy();
      }
    }

    // 5. Orphaned Meetings
    const allMeetings = await Meeting.findAll();
    for (const meeting of allMeetings) {
      const isCreatorValid = meeting.createdBy ? validUserIds.has(meeting.createdBy) : true;
      const isStudentValid = meeting.studentId ? validStudentIds.has(meeting.studentId) : true;

      if (!isCreatorValid || (meeting.studentId && !isStudentValid)) {
        console.log(`Deleting Meeting ID ${meeting.id} ("${meeting.title}") associated with deleted user/student...`);
        await meeting.destroy();
      } else if (meeting.isGroupMeeting && Array.isArray(meeting.studentIds)) {
        const filteredStudentIds = meeting.studentIds.filter(id => validStudentIds.has(id));
        if (filteredStudentIds.length !== meeting.studentIds.length) {
          if (filteredStudentIds.length === 0) {
            console.log(`Deleting group Meeting ID ${meeting.id} as all participating students were deleted...`);
            await meeting.destroy();
          } else {
            console.log(`Updating group Meeting ID ${meeting.id} studentIds...`);
            meeting.studentIds = filteredStudentIds;
            await meeting.save();
          }
        }
      }
    }

    // 6. Orphaned Tasks
    const allTasks = await Task.findAll();
    for (const task of allTasks) {
      if (!validStudentIds.has(task.studentId) || (task.supervisorId && !validUserIds.has(task.supervisorId))) {
        console.log(`Deleting Task ID ${task.id} ("${task.title}") associated with deleted student/supervisor...`);
        await task.destroy();
      }
    }

    // 7. Orphaned DefenseAlerts
    const allDefenseAlerts = await DefenseAlert.findAll();
    for (const alert of allDefenseAlerts) {
      if (!validStudentIds.has(alert.studentId)) {
        console.log(`Deleting DefenseAlert ID ${alert.id} (studentId ${alert.studentId} no longer exists)...`);
        await alert.destroy();
      }
    }

    // 8. Orphaned Notifications
    const allNotifications = await Notification.findAll();
    for (const notif of allNotifications) {
      if (!validUserIds.has(notif.userId)) {
        console.log(`Deleting Notification ID ${notif.id} (userId ${notif.userId} no longer exists)...`);
        await notif.destroy();
      }
    }

    console.log("\nCleanup completed successfully!");

  } catch (error) {
    console.error("Error during orphan cleanup:", error);
  } finally {
    await sequelize.close();
  }
}

cleanOrphans();
