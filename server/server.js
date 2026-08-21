import express from "express";

import { connectDB, sequelize } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import passwordRoutes from "./routes/passwordRoutes.js";

const app = express();

app.use(express.json());

app.use("/api/users", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", passwordRoutes);

app.listen(3000, async () => {
  try {
    await connectDB();

    await sequelize.sync({
      force: false,
    });

    console.log("Server is running on port 3000");
  } catch (error) {
    console.error("Database connection error:", error);
  }
});