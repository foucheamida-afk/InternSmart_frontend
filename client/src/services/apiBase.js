// Single definition of where the API lives.
//
// Previously each service and page hardcoded `http://localhost:3000`, which
// breaks any deployed build. Reading it from the environment once, here, means a
// deployment changes one variable rather than N files.
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Origin without the /api suffix, for links to uploaded files (served from the
// server root).
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export default API_BASE;
