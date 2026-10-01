import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import User from './server/models/userModel.js';
import Student from './server/models/studentModel.js';

async function checkUsers() {
  try {
    const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'active', 'mustChangePassword'] });
    console.log("Registered users in DB:");
    users.forEach(u => console.log(`ID: ${u.id} | Email: ${u.email} | Role: ${u.role} | Active: ${u.active} | MustChangePassword: ${u.mustChangePassword}`));
  } catch (err) {
    console.error("Error querying DB:", err.message);
  }
  process.exit(0);
}

checkUsers();
