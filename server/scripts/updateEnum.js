import { sequelize } from "../config/db.js";

const updateEnum = async () => {
  try {
    await sequelize.authenticate();

    await sequelize.query(
      "ALTER TABLE Users MODIFY COLUMN role ENUM('student', 'academic_supervisor', 'professional_supervisor', 'admin') NOT NULL"
    );
    console.log("ENUM updated successfully to include professional_supervisor");

    const [results] = await sequelize.query("SELECT id, name, email, role FROM Users WHERE id = 12");
    console.log("User 12:", results[0]);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

updateEnum();
