import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import logoImg from "../assets/images/logo.png";

const Login = () => {
  const navigate = useNavigate();

  // =========================
  // FORM STATE
  // =========================
  const [values, setValues] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  // Clear form on mount
  useEffect(() => {
    setValues({
      email: "",
      password: "",
    });
    setErrors({});
    setServerError("");
  }, []);

  // =========================
  // HANDLE INPUT CHANGES
  // =========================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field error while typing
    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));

    setServerError("");
  };

  // =========================
  // VALIDATION
  // =========================
  const validate = () => {
    const newErrors = {};

    if (!values.email.trim()) {
      newErrors.email = "Email address is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
    ) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!values.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // =========================
  // LOGIN
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("LOGIN FORM SUBMITTED");

    setServerError("");

    // Validate form
    if (!validate()) {
      console.log("VALIDATION FAILED");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/users/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: values.email.trim(),
            password: values.password,
          }),
        }
      );

      const data = await response.json();

      console.log("LOGIN RESPONSE:", data);

      // =========================
      // LOGIN FAILED
      // =========================
      if (!response.ok) {
        setServerError(
          data.message || "Invalid email or password"
        );
        return;
      }

      // =========================
      // LOGIN SUCCESSFUL
      // =========================

      console.log("LOGIN SUCCESSFUL");
      console.log("USER:", data.user);
      console.log("ROLE:", data.user.role);
      console.log(
        "REQUIRES PASSWORD CHANGE:",
        data.requiresPasswordChange
      );

      // Save JWT
      localStorage.setItem("token", data.token);

      // Save basic user information
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // =========================
      // FIRST LOGIN
      // =========================

      if (data.requiresPasswordChange === true) {
        console.log(
          "➡️ REDIRECTING TO CHANGE PASSWORD"
        );

        navigate("/change-password");
        return;
      }

      // =========================
      // ROLE-BASED REDIRECTION
      // =========================

      switch (data.user.role) {
        case "student":
          console.log(
            "🚀 REDIRECTING TO STUDENT DASHBOARD"
          );

          navigate("/student/dashboard");
          break;

        case "academic_supervisor":
          console.log(
            "🚀 REDIRECTING TO ACADEMIC SUPERVISOR DASHBOARD"
          );

         navigate("/supervisor");
         break;

        case "professional_supervisor":
          console.log(
            "🚀 REDIRECTING TO PROFESSIONAL SUPERVISOR DASHBOARD"
          );

         navigate("/professional-supervisor");
         break;

       case "admin":
         console.log(
           "🚀 REDIRECTING TO ADMIN DASHBOARD"
         );

         navigate("/admin");
         break;

        default:
          console.error(
            "UNKNOWN USER ROLE:",
            data.user.role
          );

          setServerError("Unknown user role.");
      }

    } catch (error) {
      console.error("LOGIN ERROR:", error);

      setServerError(
        "Unable to connect to the server. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-[#EFF4FA] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">

        <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">

          {/* Logo & Header */}
          <div className="flex items-center justify-between mb-8">

            <Link
              to="/"
              className="flex items-center gap-3 group"
            >
              <div>
                <img
                  src={logoImg}
                  alt="InternSmart logo"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5A623] shadow-sm transition group-hover:scale-105"
                />
              </div>

              <div>
                <p className="text-xl font-bold tracking-tight text-slate-950">
                  InternSmart
                </p>
              </div>
            </Link>

            {/* <Link
              to="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
            >
              ← Back
            </Link> */}

          </div>

          {/* Heading */}
          <div className="space-y-2 mb-8 text-center">

            <h1 className="text-3xl font-bold tracking-tight text-[#071A2D]">
              Welcome{" "}
              <span className="text-[#F5A623]">
                back
              </span>
            </h1>

            <p className="text-sm text-slate-600">
              Sign in to continue your internship supervision.
            </p>

          </div>

          {/* Server Error */}
          {serverError && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">

              <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />

              <span>{serverError}</span>

            </div>
          )}

          {/* Login Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
            autoComplete="off"
          >

            {/* EMAIL */}
            <div>

              <div className="flex items-center justify-between mb-2">

                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

              </div>

              <div className="relative">

                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={values.email}
                  onChange={handleChange}
                  className={`w-full rounded-2xl border bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition ${
                    errors.email
                      ? "border-red-400 ring-2 ring-red-400/20"
                      : "border-slate-200 focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
                  }`}
                  placeholder="Enter your email address"
                />

              </div>

              {errors.email && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">

                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />

                  <span>{errors.email}</span>

                </div>
              )}

            </div>

            {/* PASSWORD */}
            <div>

              <div className="flex items-center justify-between mb-2">

                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

              </div>

              <div className="relative">

                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="off"
                  value={values.password}
                  onChange={handleChange}
                  className={`w-full rounded-2xl border bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition ${
                    errors.password
                      ? "border-red-400 ring-2 ring-red-400/20"
                      : "border-slate-200 focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
                  }`}
                  placeholder="Enter your password"
                />

                {/* Show / Hide Password */}
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>

              </div>

              {errors.password && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">

                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />

                  <span>{errors.password}</span>

                </div>
              )}

            </div>

            {/* FORGOT PASSWORD */}
            <div className="flex justify-end">

              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#ee9403] hover:text-[#d68302] transition cursor-pointer"
              >
                Forgot password?
              </Link>

            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#F5A623] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#e69d1b] shadow-[0_10px_25px_rgba(245,166,35,0.3)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
            >

              {loading ? (
                <span className="inline-flex items-center gap-2">

                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />

                  Signing in...

                </span>
              ) : (
                <>
                  <span>Sign in</span>

                  <ArrowRight className="h-4 w-4" />
                </>
              )}

            </button>

          </form>

          {/* Administrator Notice */}
          <div className="mt-5 p-3.5 text-center text-xs text-slate-600">

            <p>
              Account creation is managed by your institution's administrator.
            </p>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Login
