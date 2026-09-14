export const getStoredToken = () => {
  return sessionStorage.getItem("token") || localStorage.getItem("token") || null;
};

export const getStoredUser = () => {
  try {
    const raw = sessionStorage.getItem("user") || localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredAuth = (user, token) => {
  if (token) {
    sessionStorage.setItem("token", token);
    localStorage.setItem("token", token);
  }
  if (user) {
    const userStr = typeof user === "string" ? user : JSON.stringify(user);
    sessionStorage.setItem("user", userStr);
    localStorage.setItem("user", userStr);
  }
};

export const clearStoredAuth = () => {
  try {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch (e) {
    console.error("Storage clear error:", e);
  }
};
