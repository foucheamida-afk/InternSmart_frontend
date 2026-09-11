import Student from "../models/studentModel.js";

export const AI_DAILY_LIMIT = 3;

export async function consumeAiRequest(student) {
  const today = new Date().toISOString().slice(0, 10);
  const requestDate = student.aiRequestsDate ? String(student.aiRequestsDate).slice(0, 10) : null;
  const requestsToday = requestDate === today ? Number(student.aiRequestsToday || 0) : 0;

  if (requestsToday >= AI_DAILY_LIMIT) {
    const error = new Error("You have used all 3 AI requests for today. Try again tomorrow.");
    error.statusCode = 429;
    error.requestsRemaining = 0;
    throw error;
  }

  await student.update({
    aiRequestsToday: requestsToday + 1,
    aiRequestsDate: today,
  });

  return {
    requestsUsed: requestsToday + 1,
    requestsRemaining: AI_DAILY_LIMIT - requestsToday - 1,
  };
}

export async function getAiQuota(userId) {
  const student = await Student.findOne({ where: { userId } });
  if (!student) return null;

  const today = new Date().toISOString().slice(0, 10);
  const requestDate = student.aiRequestsDate ? String(student.aiRequestsDate).slice(0, 10) : null;
  const requestsUsed = requestDate === today ? Number(student.aiRequestsToday || 0) : 0;

  return {
    limit: AI_DAILY_LIMIT,
    requestsUsed,
    requestsRemaining: Math.max(0, AI_DAILY_LIMIT - requestsUsed),
  };
}
