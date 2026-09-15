import { getStoredToken } from "../utils/storage";
import { API_BASE } from "./apiBase";

// Plagiarism analysis API (§4.12 phases 4-6).

const request = async (path, { method = "GET", body } = {}) => {
  const token = getStoredToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || "Something went wrong. Please try again.");
    error.status = response.status;
    error.code = data?.code || null;
    error.details = data?.details || null;
    throw error;
  }

  return data;
};

export const getReportAnalysis = (reportId) => request(`/plagiarism/reports/${reportId}/latest`);

export const requestAnalysis = (reportId, provider = null) =>
  request(`/plagiarism/reports/${reportId}/analyze`, {
    method: "POST",
    body: provider ? { provider } : {},
  });

export const getProviders = () => request("/plagiarism/providers");

export default { getReportAnalysis, requestAnalysis, getProviders };
