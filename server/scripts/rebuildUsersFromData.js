import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Task from "../models/taskModel.js";
import Meeting from "../models/meetingModel.js";
import "../models/association.js";

const DEFAULT_PASSWORD = "Pass1234!";

const rebuildUsers = async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to MySQL database.");

    // 1. Ensure Users table is created
    await User.sync();
    console.log("Users table structure verified/recreated successfully.");

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const adminHashedPassword = await bcrypt.hash("dady12345", 10);

    // 2. Ensure Admin User
    const adminEmail = "foucheamida@gmail.com";
    let admin = await User.findOne({ where: { email: adminEmail } });
    if (!admin) {
      admin = await User.create({
        name: "System Administrator",
        email: adminEmail,
        password: adminHashedPassword,
        role: "admin",
        mustChangePassword: false,
        active: true,
        status: "logged_out",
      });
      console.log(`Created Admin user (ID: ${admin.id}): ${adminEmail}`);
    } else {
      console.log(`Admin user already present (ID: ${admin.id}): ${adminEmail}`);
    }

    // 3. Scan Students table to restore Student User accounts
    const students = await Student.findAll();
    console.log(`Found ${students.length} Student records in database.`);

    for (const student of students) {
      const existingUser = await User.findByPk(student.userId);
      if (!existingUser) {
        // Create user for this student matching their userId
        const studentEmail = `student${student.id}@internsmart.com`;
        const matriculeNum = student.matricule || `STU${student.id}`;
        
        await User.create({
          id: student.userId,
          name: `Student (${matriculeNum})`,
          email: studentEmail,
          password: hashedPassword,
          role: "student",
          mustChangePassword: false,
          active: true,
          status: "logged_out",
        });
        console.log(`Restored Student User ID ${student.userId}: ${studentEmail} (Password: ${DEFAULT_PASSWORD})`);
      }
    }

    // 4. Scan Internships table for Academic & Professional Supervisors
    const internships = await Internship.findAll();
    console.log(`Found ${internships.length} Internship records in database.`);

    for (const internship of internships) {
      // Academic Supervisor
      if (internship.academicSupervisorId) {
        const existingAcadSup = await User.findByPk(internship.academicSupervisorId);
        if (!existingAcadSup) {
          const email = `academic.sup${internship.academicSupervisorId}@internsmart.com`;
          await User.create({
            id: internship.academicSupervisorId,
            name: `Academic Supervisor ${internship.academicSupervisorId}`,
            email: email,
            password: hashedPassword,
            role: "academic_supervisor",
            mustChangePassword: false,
            active: true,
            status: "logged_out",
            onboardingCompletedAt: new Date(),
          });
          console.log(`Restored Academic Supervisor User ID ${internship.academicSupervisorId}: ${email} (Password: ${DEFAULT_PASSWORD})`);
        }
      }

      // Professional Supervisor
      if (internship.professionalSupervisorId) {
        const existingProfSup = await User.findByPk(internship.professionalSupervisorId);
        if (!existingProfSup) {
          const email = internship.professionalSupervisorId === 12 ? "kapnang@gmail.com" : `prof.sup${internship.professionalSupervisorId}@internsmart.com`;
          const name = internship.professionalSupervisorId === 12 ? "Kapnang Rufus" : `Professional Supervisor ${internship.professionalSupervisorId}`;
          await User.create({
            id: internship.professionalSupervisorId,
            name: name,
            email: email,
            password: hashedPassword,
            role: "professional_supervisor",
            mustChangePassword: false,
            active: true,
            status: "logged_out",
            onboardingCompletedAt: new Date(),
          });
          console.log(`Restored Professional Supervisor User ID ${internship.professionalSupervisorId}: ${email} (Password: ${DEFAULT_PASSWORD})`);
        }
      }
    }

    // 5. Check Kapnang Rufus professional supervisor
    const kapnangUser = await User.findOne({ where: { email: "kapnang@gmail.com" } });
    if (!kapnangUser) {
      const kap = await User.create({
        name: "Kapnang Rufus",
        email: "kapnang@gmail.com",
        password: hashedPassword,
        role: "professional_supervisor",
        mustChangePassword: false,
        active: true,
        status: "logged_out",
        onboardingCompletedAt: new Date(),
      });
      console.log(`Created Professional Supervisor Kapnang Rufus (ID: ${kap.id}): kapnang@gmail.com (Password: ${DEFAULT_PASSWORD})`);
    }

    console.log("\n=========================================");
    console.log("USER TABLE REBUILD COMPLETED SUCCESSFULLY");
    console.log("=========================================\n");

  } catch (error) {
    console.error("Error rebuilding Users table:", error);
  } finally {
    await sequelize.close();
  }
};

rebuildUsers();
