import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const repair = async () => {
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "internSmart";
  const port = process.env.DB_PORT || 3306;

  console.log(`Connecting directly to MySQL at ${host}:${port} as ${user}...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log(`Connected to database "${database}".`);

    // 1. Check existing tables
    const [rows] = await connection.query("SHOW TABLES");
    console.log("Current tables in database:", rows.map(r => Object.values(r)[0]));

    // 2. Try dropping Users table
    console.log("Attempting to DROP TABLE IF EXISTS Users...");
    await connection.query("DROP TABLE IF EXISTS `Users`").catch(e => console.log("Drop Users error:", e.message));
    await connection.query("DROP TABLE IF EXISTS `users`").catch(e => console.log("Drop users error:", e.message));

    // 3. Attempt CREATE TABLE Users
    console.log("Attempting CREATE TABLE Users...");
    const createSql = `
      CREATE TABLE \`Users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('student', 'academic_supervisor', 'professional_supervisor', 'admin') NOT NULL,
        \`mustChangePassword\` TINYINT(1) NOT NULL DEFAULT 1,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`status\` ENUM('online', 'offline', 'logged_in', 'logged_out', 'deactivated') NOT NULL DEFAULT 'logged_out',
        \`lastLoginAt\` DATETIME,
        \`lastLogoutAt\` DATETIME,
        \`deactivatedAt\` DATETIME,
        \`otpCode\` VARCHAR(255),
        \`otpExpires\` DATETIME,
        \`otpAttempts\` INT NOT NULL DEFAULT 0,
        \`phone\` VARCHAR(255),
        \`organisation\` VARCHAR(255),
        \`jobTitle\` VARCHAR(255),
        \`onboardingCompletedAt\` DATETIME,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
      await connection.query(createSql);
      console.log("SUCCESS: Created `Users` table cleanly!");
    } catch (createErr) {
      console.error("CREATE TABLE `Users` failed:", createErr.message);

      // If capitalized `Users` is locked by InnoDB dictionary, try `users_accounts` table name
      console.log("Attempting CREATE TABLE `user_accounts`...");
      const altSql = createSql.replace("`Users`", "`user_accounts`");
      await connection.query(altSql);
      console.log("SUCCESS: Created `user_accounts` table as fallback!");
    }

  } catch (err) {
    console.error("Repair script error:", err);
  } finally {
    if (connection) await connection.end();
  }
};

repair();
