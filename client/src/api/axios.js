import axios from "axios";
import { getStoredToken, clearStoredAuth } from "../utils/storage";

const api = axios.create({
  // Configurable per environment; VITE_API_URL is optional and falls back to the
  // original local value so existing setups keep working unchanged.
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      const isAuthPage = ["/login", "/", "/change-password"].includes(window.location.pathname);

      if (!isAuthPage) {
        clearStoredAuth();
        window.dispatchEvent(new Event("auth:logout"));
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
