import { getStoredToken } from "../utils/storage";
import { API_BASE } from "./apiBase";

// Virtual library API (§4.12 phase 3).
//
// The server decides what each caller may see: rows are scoped in SQL and fields
// are filtered per entry, so a student receives no file location for a document
// they may not open. This layer simply carries that through - it must not
// "helpfully" fill in a missing field.

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
    throw error;
  }

  return data;
};

const toQuery = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

export const searchLibrary = (params) => request(`/library/reports${toQuery(params)}`);

export const getLibraryFacets = () => request("/library/facets");

export const getLibraryEntry = (id) => request(`/library/reports/${id}`);

export const openLibraryReport = (id) => request(`/library/reports/${id}/preview`);

export const setLibraryVisibility = (id, visibility) =>
  request(`/library/reports/${id}/visibility`, { method: "PUT", body: { visibility } });

// Abstract and keywords are author-supplied: they are what make the library
// searchable, and nothing can derive them from the file.
export const setLibraryDetails = (id, details) =>
  request(`/library/reports/${id}/details`, { method: "PUT", body: details });

export default {
  searchLibrary,
  getLibraryFacets,
  getLibraryEntry,
  openLibraryReport,
  setLibraryVisibility,
};
