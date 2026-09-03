import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import association from "../models/association.js";

const createProfessionalSupervisor = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const supervisorEmail = "kapnang@gmail.com";
    const supervisorPassword = "Pass1234!";
    const supervisorName = "Kapnang Rufus";

    const existingSupervisor = await User.findOne({ where: { email: supervisorEmail } });
    if (existingSupervisor) {
      console.log("Professional supervisor already exists:", supervisorEmail);
      console.log("ID:", existingSupervisor.id);
    } else {
      const hashedPassword = await bcrypt.hash(supervisorPassword, 10);

      const supervisor = await User.create({
        name: supervisorName,
        email: supervisorEmail,
        password: hashedPassword,
        role: "professional_supervisor",
        mustChangePassword: true,
        active: true,
      });

      console.log("Professional supervisor created successfully!");
      console.log("ID:", supervisor.id);
    }

    const supervisor = await User.findOne({ where: { email: supervisorEmail } });

    const sarah = await Student.findOne({
      include: [
        {
          model: User,
          as: "user",
          where: { name: "Sarah Brown" },
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!sarah) {
      console.log("Student 'Sarah Brown' not found. Looking for similar names...");
      const allStudents = await Student.findAll();
      for (const s of allStudents) {
        console.log(`  - Student ID ${s.id}: ${s.matricule}`);
      }
      process.exit(1);
    }

    console.log("Found student: Sarah Brown (ID:", sarah.id, ", Matricule:", sarah.matricule, ")");

    const internship = await Internship.findOne({ where: { studentId: sarah.id } });

    if (!internship) {
      console.log("No internship found for Sarah Brown.");
      process.exit(1);
    }

    await internship.update({ professionalSupervisorId: supervisor.id, company: "TechCorp Solutions" });
    console.log("Linked professional supervisor to Sarah Brown's internship (Internship ID:", internship.id, ")");

    console.log("\n===== LOGIN CREDENTIALS =====");
    console.log("Professional Supervisor Email:", supervisorEmail);
    console.log("Professional Supervisor Password:", supervisorPassword);
    console.log("Login URL: http://localhost:5173/login");
    console.log("Redirects to: http://localhost:5173/professional-supervisor");
    console.log("=============================\n");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

createProfessionalSupervisor();
