import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import User from './server/models/userModel.js';
import Report from './server/models/reportModel.js';
import ReportVersion from './server/models/reportVersionModel.js';

async function main() {
  const users = await User.findAll({ where: { role: 'student' }, limit: 5 });
  console.log('Students:');
  users.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}`));

  const reports = await Report.findAll({ limit: 10 });
  console.log('\nReports:');
  for (const r of reports) {
    const v = r.currentVersionId ? await ReportVersion.findByPk(r.currentVersionId) : null;
    console.log(`Report ID: ${r.id}, StudentId: ${r.studentId}, Title: ${r.title}, File: ${r.fileName}, Url: ${v?.fileUrl || r.fileUrl}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
