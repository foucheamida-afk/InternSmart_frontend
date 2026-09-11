import { extractTextFromPDF } from "../services/pdfService.js";
import { generateGeminiResponse } from "../services/geminiService.js";
import { buildReportReviewPrompt, buildWritingAssistantPrompt } from "../prompts/reportReviewPrompt.js";
import Student from "../models/studentModel.js";
import Report from "../models/reportModel.js";
import { consumeAiRequest, getAiQuota } from "../utils/aiQuota.js";
import fs from "fs";
import path from "path";

export async function reviewReport(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "PDF report is required.",
      });
    }

    const student = await Student.findOne({ where: { userId: req.user.id } });
    const quota = student ? await consumeAiRequest(student) : null;

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
    console.error(
      "AI report review error:",
      error
    );
    console.error("Error stack:", error.stack);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to review the report.",
      ...(error.requestsRemaining != null ? { requestsRemaining: error.requestsRemaining } : {}),
    });
  }
}

export async function writingAssistant(req, res) {
  try {
    const question = String(req.body.question || "").trim();
    const reportId = Number(req.body.reportId);
    if (!question) return res.status(400).json({ message: "A question is required." });
    if (!Number.isInteger(reportId)) return res.status(400).json({ message: "A report is required." });

    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found." });

    const report = await Report.findOne({ where: { id: reportId, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found." });

    const quota = await consumeAiRequest(student);
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
    if (!reportText) return res.status(400).json({ message: "This report has no readable content yet.", quota });

    const response = await generateGeminiResponse(buildWritingAssistantPrompt(reportText, question));
    return res.json({ answer: response, quota, reportId });
  } catch (error) {
    console.error("AI WRITING ASSISTANT ERROR:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Unable to answer the question.",
      ...(error.requestsRemaining != null ? { requestsRemaining: error.requestsRemaining } : {}),
    });
  }
}

export async function getWritingAssistantQuota(req, res) {
  const quota = await getAiQuota(req.user.id);
  return res.json(quota || { limit: 3, requestsUsed: 0, requestsRemaining: 3 });
}