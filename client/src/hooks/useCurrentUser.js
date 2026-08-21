/**
 * useCurrentUser – reads the logged-in user from localStorage.
 * Populated by Login.jsx on every successful sign-in.
 * Falls back to sensible defaults so dashboards never show empty state.
 */
export function useCurrentUser() {
  const raw = localStorage.getItem("internSmart_user");

  const fallback = {
    name: "User",
    email: "",
    role: "Student",
    department: "Software Engineering",
    program: "Level 3",
    initials: "U",
    notifications: 2,
  };

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      initials:
        parsed.initials ||
        (parsed.name || "U")
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase(),
    };
  } catch {
    return fallback;
  }
}
