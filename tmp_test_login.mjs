async function test() {
  try {
    console.log("Testing server connectivity on http://localhost:3000/api/users/login ...");
    const res = await fetch("http://localhost:3000/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@example.com", password: "password" })
    });
    console.log("Login HTTP status:", res.status);
    const data = await res.json();
    console.log("Login response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Test error:", err.message);
  }
}

test();
