import api from "../api/axios";

export const studentDashboardService = {
  fetchDashboardStats: () => api.get("/students/dashboard-stats"),
  fetchMyReports: () => api.get("/students/my-reports"),
  fetchMyMeetings: () => api.get("/students/my-meetings"),
  fetchMyNotifications: () => api.get("/students/my-notifications"),
  fetchMyTasks: () => api.get("/students/my-tasks"),
  markNotificationRead: (id) => api.put(`/students/notifications/${id}/read`),
  toggleTaskComplete: (id) => api.put(`/students/tasks/${id}/toggle`),
  fetchFinalGrade: () => api.get("/students/my-final-grade").then(res => res.data),
};

export const publicTimelineService = {
  get: () => api.get("/timeline").then(res => res.data),
};
