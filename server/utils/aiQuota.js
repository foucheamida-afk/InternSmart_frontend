import Student from "../models/studentModel.js";

export const AI_DAILY_LIMIT = 5;

export async function consumeAiRequest(student) {
  const today = new Date().toISOString().slice(0, 10);
  const requestDate = student.aiRequestsDate ? String(student.aiRequestsDate).slice(0, 10) : null;
  const requestsToday = requestDate === today ? Number(student.aiRequestsToday || 0) : 0;

  if (requestsToday >= AI_DAILY_LIMIT) {
    const error = new Error(`You have reached your daily limit of ${AI_DAILY_LIMIT} AI requests. Please try again tomorrow.`);
    error.statusCode = 429;
    error.requestsRemaining = 0;
    throw error;
  }

  await student.update({
    aiRequestsToday: requestsToday + 1,
    aiRequestsDate: today,
  });

  return {
    limit: AI_DAILY_LIMIT,
    requestsUsed: requestsToday + 1,
    requestsRemaining: AI_DAILY_LIMIT - requestsToday - 1,
  };
}

/**
 * Give back a request consumed earlier today. Used to compensate a failed AI
 * attempt: the quota is charged up-front (so concurrent calls cannot race past
 * the limit), so any failure must refund it rather than silently burning the
 * student's daily allowance (NFR-REL-03).
 */
export async function refundAiRequest(student) {
  const today = new Date().toISOString().slice(0, 10);
  const requestDate = student.aiRequestsDate ? String(student.aiRequestsDate).slice(0, 10) : null;

  // Only refund a request that was actually charged today.
  if (requestDate !== today) return null;

  const requestsToday = Number(student.aiRequestsToday || 0);
  if (requestsToday <= 0) return null;

  const requestsUsed = requestsToday - 1;

  await student.update({ aiRequestsToday: requestsUsed });

  return {
    limit: AI_DAILY_LIMIT,
    requestsUsed,
    requestsRemaining: Math.max(0, AI_DAILY_LIMIT - requestsUsed),
  };
}

export async function getAiQuota(userId) {
  const student = await Student.findOne({ where: { userId } });
  if (!student) return { limit: AI_DAILY_LIMIT, requestsUsed: 0, requestsRemaining: AI_DAILY_LIMIT };

  const today = new Date().toISOString().slice(0, 10);
  const requestDate = student.aiRequestsDate ? String(student.aiRequestsDate).slice(0, 10) : null;
  const requestsUsed = requestDate === today ? Number(student.aiRequestsToday || 0) : 0;

  return {
    limit: AI_DAILY_LIMIT,
    requestsUsed,
    requestsRemaining: Math.max(0, AI_DAILY_LIMIT - requestsUsed),
  };
}
