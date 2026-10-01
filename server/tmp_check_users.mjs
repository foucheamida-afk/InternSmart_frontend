import dotenv from 'dotenv';
dotenv.config();
import User from './models/userModel.js';
import bcrypt from 'bcrypt';

async function testStudentLogin() {
  try {
    let student = await User.findOne({ where: { role: 'student', active: true } });
    if (!student) {
      console.log("No active student found");
      process.exit(1);
    }
    console.log("Found student:", student.id, student.email);

    // Set a known test password for this student
    const hashedPassword = await bcrypt.hash('password123', 10);
    await student.update({ password: hashedPassword, mustChangePassword: false });
    console.log("Updated student password to 'password123'");

    // Test API call to /api/users/login
    const loginRes = await fetch("http://localhost:3000/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: student.email, password: "password123" })
    });

    console.log("Login HTTP status:", loginRes.status);
    const loginData = await loginRes.json();
    console.log("Login response:", JSON.stringify(loginData, null, 2));

    if (loginData.token) {
      console.log("\nTesting /api/students/me with token...");
      const meRes = await fetch("http://localhost:3000/api/students/me", {
        headers: { "Authorization": `Bearer ${loginData.token}` }
      });
      console.log("/students/me status:", meRes.status);
      const meData = await meRes.json();
      console.log("/students/me response:", JSON.stringify(meData, null, 2));

      console.log("\nTesting /api/students/dashboard-stats with token...");
      const statsRes = await fetch("http://localhost:3000/api/students/dashboard-stats", {
        headers: { "Authorization": `Bearer ${loginData.token}` }
      });
      console.log("/students/dashboard-stats status:", statsRes.status);
      const statsData = await statsRes.json();
      console.log("/students/dashboard-stats response:", JSON.stringify(statsData, null, 2));

      console.log("\nTesting /api/students/my-notifications with token...");
      const notifRes = await fetch("http://localhost:3000/api/students/my-notifications", {
        headers: { "Authorization": `Bearer ${loginData.token}` }
      });
      console.log("/students/my-notifications status:", notifRes.status);
      const notifData = await notifRes.json();
      console.log("/students/my-notifications response:", JSON.stringify(notifData, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

testStudentLogin();
