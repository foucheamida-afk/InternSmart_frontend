import { useState } from "react";
import { reviewReportPDF } from "../../services/aiService";
import api from "../../api/axios";

export default function ReportAIReview() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    setError("");
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Check file type
    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }

    // Check 20 MB limit
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("The PDF must not exceed 20 MB.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleReview = async () => {
    if (!file) {
      setError("Please select a PDF report first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const data = await reviewReportPDF(file);

      setResult(data);
    } catch (error) {
      console.error("AI review error:", error);

      setError(
        error.response?.data?.message ||
        "Failed to analyze the report."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Upload Card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h2 className="text-xl font-semibold">
          AI Report Reviewer
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Upload your internship report in PDF format
          to receive feedback on language, academic
          quality, structure and school requirements.
        </p>

        {/* File Input */}
        <div className="mt-6">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="block w-full text-sm"
          />
        </div>

        {/* Selected File */}
        {file && (
          <div className="mt-4 rounded-xl bg-gray-50 p-4">

            <p className="font-medium">
              {file.name}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>

          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Analyze Button */}
        <button
          type="button"
          onClick={handleReview}
          disabled={!file || loading}
          className="mt-6 rounded-xl bg-orange-500 px-6 py-3 font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Analyzing report..."
            : "Analyze Report"}
        </button>

      </div>

      {/* Results */}
      {result?.review && (
        <ReviewResult review={result.review} />
      )}

    </div>
  );
}

function ReviewResult({ review }) {
  const summary = review.reviewSummary;

  return (
    <div className="space-y-6">

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">

        <ScoreCard
          title="Overall"
          score={summary.overallScore}
        />

        <ScoreCard
          title="Language"
          score={summary.languageScore}
        />

        <ScoreCard
          title="Academic"
          score={summary.academicScore}
        />

        <ScoreCard
          title="Structure"
          score={summary.structureScore}
        />

        <ScoreCard
          title="Requirements"
          score={summary.requirementsScore}
        />

      </div>

      {/* Issue Summary */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h3 className="text-lg font-semibold">
          Issue Summary
        </h3>

        <div className="mt-4 grid grid-cols-3 gap-4">

          <div className="rounded-xl bg-red-50 p-4">
            <p className="text-sm text-gray-500">
              High
            </p>

            <p className="mt-1 text-2xl font-bold text-red-600">
              {summary.issueCounts?.high || 0}
            </p>
          </div>

          <div className="rounded-xl bg-yellow-50 p-4">
            <p className="text-sm text-gray-500">
              Medium
            </p>

            <p className="mt-1 text-2xl font-bold">
              {summary.issueCounts?.medium || 0}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Low
            </p>

            <p className="mt-1 text-2xl font-bold">
              {summary.issueCounts?.low || 0}
            </p>
          </div>

        </div>

      </div>

      {/* Section Review */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h3 className="text-lg font-semibold">
          Section Review
        </h3>

        <div className="mt-4 space-y-3">

          {review.sectionReview?.map(
            (section, index) => (

              <div
                key={index}
                className="rounded-xl border p-4"
              >

                <div className="flex items-center justify-between">

                  <h4 className="font-medium">
                    {section.section}
                  </h4>

                  <span className="text-sm font-semibold">
                    {section.score}/100
                  </span>

                </div>

                <p className="mt-2 text-sm text-gray-600">
                  {section.feedback}
                </p>

                <p className="mt-2 text-xs font-semibold">
                  {section.status}
                </p>

              </div>

            )
          )}

        </div>

      </div>

      {/* Issues */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h3 className="text-lg font-semibold">
          Detected Issues
        </h3>

        <div className="mt-4 space-y-4">

          {review.issues?.length === 0 ? (

            <p className="text-sm text-gray-500">
              No issues were detected.
            </p>

          ) : (

            review.issues.map((issue, index) => (

              <div
                key={index}
                className="rounded-xl border p-4"
              >

                <div className="flex items-center justify-between">

                  <div>
                    <p className="font-medium capitalize">
                      {issue.category.replace("_", " ")}
                    </p>

                    <p className="text-xs text-gray-500">
                      {issue.section}
                    </p>
                  </div>

                  <span className="text-sm font-semibold">
                    {issue.severity}
                  </span>

                </div>

                {/* Original text */}
                {issue.originalText && (
                  <div className="mt-4">

                    <p className="text-xs font-semibold text-gray-500">
                      Problematic text
                    </p>

                    <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm">
                      "{issue.originalText}"
                    </p>

                  </div>
                )}

                {/* Explanation */}
                <div className="mt-4">

                  <p className="text-xs font-semibold text-gray-500">
                    Explanation
                  </p>

                  <p className="mt-1 text-sm">
                    {issue.explanation}
                  </p>

                </div>

                {/* Suggestion */}
                <div className="mt-4">

                  <p className="text-xs font-semibold text-gray-500">
                    Suggestion
                  </p>

                  <p className="mt-1 text-sm">
                    {issue.suggestion}
                  </p>

                </div>

              </div>

            ))

          )}

        </div>

      </div>

      {/* Missing Requirements */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h3 className="text-lg font-semibold">
          Missing Requirements
        </h3>

        <div className="mt-4 space-y-3">

          {review.missingRequirements?.length === 0 ? (

            <p className="text-sm text-gray-500">
              No missing requirements were detected.
            </p>

          ) : (

            review.missingRequirements.map(
              (item, index) => (

                <div
                  key={index}
                  className="rounded-xl border p-4"
                >

                  <div className="flex items-center justify-between">

                    <p className="font-medium">
                      {item.requirement}
                    </p>

                    <span className="text-xs font-semibold">
                      {item.status}
                    </span>

                  </div>

                  <p className="mt-2 text-sm text-gray-600">
                    {item.explanation}
                  </p>

                </div>

              )
            )

          )}

        </div>

      </div>

      {/* Strengths */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h3 className="text-lg font-semibold">
          Strengths
        </h3>

        <ul className="mt-4 list-disc space-y-2 pl-5">

          {review.strengths?.map(
            (strength, index) => (
              <li key={index}>
                {strength}
              </li>
            )
          )}

        </ul>

      </div>

      {/* General Feedback */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">

        <h3 className="text-lg font-semibold">
          General Feedback
        </h3>

        <ul className="mt-4 list-disc space-y-2 pl-5">

          {review.generalFeedback?.map(
            (feedback, index) => (
              <li key={index}>
                {feedback}
              </li>
            )
          )}

        </ul>

      </div>

    </div>
  );
}


function ScoreCard({ title, score }) {
  return (
    <div className="rounded-xl border bg-white p-4 text-center shadow-sm">

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {score}
      </p>

      <p className="text-xs text-gray-400">
        / 100
      </p>

    </div>
  );
}