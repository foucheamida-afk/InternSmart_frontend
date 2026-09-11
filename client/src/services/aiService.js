import api from "../api/axios";

export async function reviewReportPDF(file) {
  const formData = new FormData();

  formData.append("report", file);

  const response = await api.post(
    "/ai/review-report",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}

export async function askWritingAssistant(reportId, question) {
  const response = await api.post('/ai/writing-assistant', { reportId, question });
  return response.data;
}