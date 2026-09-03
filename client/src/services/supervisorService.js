import api from "../api/axios";

export const supervisorApi = {
  getMyInterns: (params) => api.get("/supervisor/my-interns", { params }).then(res => res.data),
  getTasks: (params) => api.get("/supervisor/tasks", { params }).then(res => res.data),
  createTask: (data) => api.post("/supervisor/tasks", data).then(res => res.data),
  updateTask: (id, data) => api.put(`/supervisor/tasks/${id}`, data).then(res => res.data),
  deleteTask: (id) => api.delete(`/supervisor/tasks/${id}`).then(res => res.data),
  getMeetings: (params) => api.get("/supervisor/meetings", { params }).then(res => res.data),
  createMeeting: (data) => api.post("/supervisor/meetings", data).then(res => res.data),
  updateMeeting: (id, data) => api.put(`/supervisor/meetings/${id}`, data).then(res => res.data),
  deleteMeeting: (id) => api.delete(`/supervisor/meetings/${id}`).then(res => res.data),
  initiateMeeting: (id) => api.put(`/supervisor/meetings/${id}/initiate`).then(res => res.data),
  getNotifications: (params) => api.get("/supervisor/notifications", { params }).then(res => res.data),
  markNotificationRead: (id) => api.put(`/supervisor/notifications/${id}/read`).then(res => res.data),
  getReports: (params) => api.get("/supervisor/reports", { params }).then(res => res.data),
  submitFeedback: (id, data) => api.put(`/supervisor/reports/${id}/feedback`, data).then(res => res.data),
  getFinalGrade: (studentId) => api.get(`/supervisor/interns/${studentId}/grade`).then(res => res.data),
  submitFinalGrade: (studentId, data) => api.post(`/supervisor/interns/${studentId}/grade`, data).then(res => res.data),
};
