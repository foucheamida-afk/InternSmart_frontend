import { createContext, useContext, useState, useEffect } from "react";
import { getStoredToken, getStoredUser, setStoredAuth, clearStoredAuth } from "../utils/storage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && token) {
      setStoredAuth(user, token);
    }
  }, [user, token]);

  useEffect(() => {
    const handleLogout = () => {
      clearStoredAuth();
      setUser(null);
      setToken(null);
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = (userData, tokenValue) => {
    setStoredAuth(userData, tokenValue);
    setUser(userData);
    setToken(tokenValue);
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
  };

  const refreshUser = (userData) => {
    setUser(userData);
    if (token) {
      setStoredAuth(userData, token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, setLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
