import api from "../api/axios";

export const professionalSupervisorApi = {
  getMyInterns: (params) => api.get("/professional-supervisor/my-interns", { params }).then(res => res.data),
  getTasks: (params) => api.get("/professional-supervisor/tasks", { params }).then(res => res.data),
  createTask: (data) => api.post("/professional-supervisor/tasks", data).then(res => res.data),
  updateTask: (id, data) => api.put(`/professional-supervisor/tasks/${id}`, data).then(res => res.data),
  deleteTask: (id) => api.delete(`/professional-supervisor/tasks/${id}`).then(res => res.data),
  submitFeedback: (id, data) => api.put(`/professional-supervisor/tasks/${id}/feedback`, data).then(res => res.data),
  getStats: () => api.get("/professional-supervisor/stats").then(res => res.data),

  // Meetings
  getMeetings: (params) => api.get("/professional-supervisor/meetings", { params }).then(res => res.data),
  createMeeting: (data) => api.post("/professional-supervisor/meetings", data).then(res => res.data),
  updateMeeting: (id, data) => api.put(`/professional-supervisor/meetings/${id}`, data).then(res => res.data),
  deleteMeeting: (id) => api.delete(`/professional-supervisor/meetings/${id}`).then(res => res.data),
  initiateMeeting: (id) => api.put(`/professional-supervisor/meetings/${id}/initiate`).then(res => res.data),

  // Grades
  getFinalGrade: (studentId) => api.get(`/professional-supervisor/interns/${studentId}/grade`).then(res => res.data),
  submitFinalGrade: (studentId, data) => api.post(`/professional-supervisor/interns/${studentId}/grade`, data).then(res => res.data),
};
