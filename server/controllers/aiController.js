import { extractTextFromPDF } from "../services/pdfService.js";
import { generateGeminiResponse } from "../services/geminiService.js";
import { buildReportReviewPrompt, buildWritingAssistantPrompt } from "../prompts/reportReviewPrompt.js";
import Student from "../models/studentModel.js";
import Report from "../models/reportModel.js";
import { consumeAiRequest, getAiQuota, refundAiRequest, AI_DAILY_LIMIT } from "../utils/aiQuota.js";
import fs from "fs";
import path from "path";

// The daily quota is charged up-front so concurrent calls cannot race past the
// limit. Every failure path below therefore refunds it, otherwise a network or
// parsing error would silently burn the student's allowance (NFR-REL-03).
export async function reviewReport(req, res) {
  let student = null;
  let quota = null;
  let quotaCharged = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "PDF report is required.",
      });
    }

    student = await Student.findOne({ where: { userId: req.user.id } });
    if (student) {
      quota = await consumeAiRequest(student);
      quotaCharged = true;
    }

    const { text, pages } =
      await extractTextFromPDF(req.file.buffer);

    const prompt =
      buildReportReviewPrompt(text);

    const rawResponse =
      await generateGeminiResponse(prompt);

    const cleanedResponse = rawResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const review = JSON.parse(cleanedResponse);

    return res.json({
      fileName: req.file.originalname,
      pages,
      extractedCharacters: text.length,
      review,
      quota,
    });

  } catch (error) {
    if (quotaCharged && student) {
      const refunded = await refundAiRequest(student);
      if (refunded) quota = refunded;
    }

    console.error(
      "AI report review error:",
      error
    );
    console.error("Error stack:", error.stack);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to review the report.",
      ...(error.requestsRemaining != null ? { requestsRemaining: error.requestsRemaining } : {}),
      ...(quota ? { quota } : {}),
    });
  }
}

export async function writingAssistant(req, res) {
  let student = null;
  let quota = null;
  let quotaCharged = false;

  try {
    const question = String(req.body.question || "").trim();
    const reportId = Number(req.body.reportId);
    if (!question) return res.status(400).json({ message: "A question is required." });
    if (!Number.isInteger(reportId)) return res.status(400).json({ message: "A report is required." });

    student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found." });

    const report = await Report.findOne({ where: { id: reportId, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found." });

    quota = await consumeAiRequest(student);
    quotaCharged = true;

    let reportText = "";
    if (report.fileUrl) {
      const relativeFile = report.fileUrl.replace(/^\/uploads\//, "");
      const filePath = path.join(process.cwd(), "uploads", relativeFile);
      if (fs.existsSync(filePath)) {
        reportText = (await extractTextFromPDF(fs.readFileSync(filePath))).text;
      }
    }
    if (!reportText && report.documentContent) {
      reportText = JSON.stringify(report.documentContent);
    }
    if (!reportText) {
      // Nothing was asked of the AI, so hand the request straight back.
      const refunded = await refundAiRequest(student);
      if (refunded) quota = refunded;
      quotaCharged = false;
      return res.status(400).json({ message: "This report has no readable content yet.", quota });
    }

    const response = await generateGeminiResponse(buildWritingAssistantPrompt(reportText, question));
    return res.json({ answer: response, quota, reportId });
  } catch (error) {
    if (quotaCharged && student) {
      const refunded = await refundAiRequest(student);
      if (refunded) quota = refunded;
    }

    console.error("AI WRITING ASSISTANT ERROR:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Unable to answer the question.",
      ...(error.requestsRemaining != null ? { requestsRemaining: error.requestsRemaining } : {}),
      ...(quota ? { quota } : {}),
    });
  }
}

export async function getWritingAssistantQuota(req, res) {
  const quota = await getAiQuota(req.user.id);
  // Previously fell back to a hardcoded limit of 3, contradicting AI_DAILY_LIMIT (5).
  return res.json(quota || { limit: AI_DAILY_LIMIT, requestsUsed: 0, requestsRemaining: AI_DAILY_LIMIT });
}
