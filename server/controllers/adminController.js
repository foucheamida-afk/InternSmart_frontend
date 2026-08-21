import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import generateTemporaryPassword from "../utils/generatePassword.js";

const createStudent = async (req, res) => {
  try {
    const {
      student_name,
      student_email,
      student_matricule,
      class: studentClass,
      academic_supervisor_name,
      academic_supervisor_email,
      professional_supervisor_name,
      professional_supervisor_email,
      company,
    } = req.body;

    
    // 1. VALIDATE REQUIRED INFORMATION


    if (
      !student_name ||
      !student_email ||
      !student_matricule ||
      !studentClass ||
      !academic_supervisor_name ||
      !academic_supervisor_email ||
      !professional_supervisor_name ||
      !professional_supervisor_email ||
      !company
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

   
    // 2. CHECK IF STUDENT EMAIL ALREADY EXISTS
  

    const existingStudentUser = await User.findOne({
      where: {
        email: student_email.trim(),
      },
    });

    if (existingStudentUser) {
      return res.status(409).json({
        message: "Student email already exists",
      });
    }

    
    // 3. CHECK IF MATRICULE ALREADY EXISTS
    

    const existingMatricule = await Student.findOne({
      where: {
        matricule: student_matricule.trim(),
      },
    });

    if (existingMatricule) {
      return res.status(409).json({
        message: "Student matricule already exists",
      });
    }

    
    // 4. CREATE STUDENT ACCOUNT
    
    const studentTemporaryPassword =
      generateTemporaryPassword();

    const hashedStudentPassword = await bcrypt.hash(
      studentTemporaryPassword,
      10
    );

    const studentUser = await User.create({
      name: student_name.trim(),
      email: student_email.trim(),
      password: hashedStudentPassword,
      role: "student",
      mustChangePassword: true,
    });

   
    // 5. CREATE STUDENT PROFILE

    const student = await Student.create({
      userId: studentUser.id,
      matricule: student_matricule.trim(),
      class: studentClass.trim(),
    });

    
    // 6. FIND ACADEMIC SUPERVISOR
  

    let academicSupervisor = await User.findOne({
      where: {
        email: academic_supervisor_email.trim(),
      },
    });

    let academicTemporaryPassword = null;

    // If supervisor doesn't exist, create account
    if (!academicSupervisor) {
      academicTemporaryPassword =
        generateTemporaryPassword();

      const hashedPassword = await bcrypt.hash(
        academicTemporaryPassword,
        10
      );

      academicSupervisor = await User.create({
        name: academic_supervisor_name.trim(),
        email: academic_supervisor_email.trim(),
        password: hashedPassword,
        role: "academic_supervisor",
        mustChangePassword: true,
      });
    }

    // Make sure existing account has correct role
    if (academicSupervisor.role !== "academic_supervisor") {
      return res.status(400).json({
        message:
          "The academic supervisor email belongs to another role",
      });
    }

    // 7. FIND PROFESSIONAL SUPERVISOR
   

    let professionalSupervisor = await User.findOne({
      where: {
        email: professional_supervisor_email.trim(),
      },
    });

    let professionalTemporaryPassword = null;

    // If supervisor doesn't exist, create account
    if (!professionalSupervisor) {
      professionalTemporaryPassword =
        generateTemporaryPassword();

      const hashedPassword = await bcrypt.hash(
        professionalTemporaryPassword,
        10
      );

      professionalSupervisor = await User.create({
        name: professional_supervisor_name.trim(),
        email: professional_supervisor_email.trim(),
        password: hashedPassword,
        role: "professional",
        mustChangePassword: true,
      });
    }

    // Make sure existing account has correct role
    if (professionalSupervisor.role !== "professional") {
      return res.status(400).json({
        message:
          "The professional supervisor email belongs to another role",
      });
    }

    
    // 8. CREATE INTERNSHIP RELATIONSHIP
  

    const internship = await Internship.create({
      studentId: student.id,
      academicSupervisorId: academicSupervisor.id,
      professionalSupervisorId: professionalSupervisor.id,
      company: company.trim(),
    });

    
    // 9. RETURN RESULT
   

    return res.status(201).json({
      message: "Student and internship created successfully",

      student: {
        id: studentUser.id,
        name: studentUser.name,
        email: studentUser.email,
        matricule: student.matricule,
        class: student.class,
        role: studentUser.role,
        temporaryPassword: studentTemporaryPassword,
      },

      academicSupervisor: {
        id: academicSupervisor.id,
        name: academicSupervisor.name,
        email: academicSupervisor.email,
        role: academicSupervisor.role,
        temporaryPassword: academicTemporaryPassword,
      },

      professionalSupervisor: {
        id: professionalSupervisor.id,
        name: professionalSupervisor.name,
        email: professionalSupervisor.email,
        role: professionalSupervisor.role,
        temporaryPassword: professionalTemporaryPassword,
      },

      internship: {
        id: internship.id,
        company: internship.company,
      },
    });
  } catch (error) {
    console.error("CREATE STUDENT ERROR:", error);

    return res.status(500).json({
      message: "Error creating student",
      error: error.message,
    });
  }
};

export default createStudent;