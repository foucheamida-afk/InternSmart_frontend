import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldAlert } from 'lucide-react'
import logoImg from '../assets/images/logo.png'

const Login = () => {
  const navigate = useNavigate()
  const [values, setValues] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // VALIDATION

  const validateForm = (formValues) => {
    const errs = {};

    // Email
    if (!formValues.email.trim()) {
      errs.email = "Email address is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email.trim())
    ) {
      errs.email = "Please enter a valid email address";
    }

    // Password
    if (!formValues.password) {
      errs.password = "Password is required";
    }

    return errs;
  };

  // HANDLE CHANGE

  const handleChange = (e) => {
    const { name, value } = e.target;

    const newValues = {
      ...values,
      [name]: value,
    };

    setValues(newValues);

    // Clear server error when user edits
    setServerError("");
    setSuccessMessage("");

    // Validate while typing
    const validationErrors = validateForm(newValues);
    setErrors(validationErrors);
  };

  // LOGIN

  const determineRoleAndNavigate = (userEmail, roleFromBackend) => {
    const normalizedEmail = (userEmail || '').toLowerCase().trim()
    const role = (roleFromBackend || '').toLowerCase()

    let resolvedRole = 'student'
    if (role === 'admin' || normalizedEmail.includes('admin')) {
      resolvedRole = 'admin'
    } else if (
      role === 'supervisor' ||
      normalizedEmail.includes('supervisor') ||
      normalizedEmail.includes('prof') ||
      normalizedEmail.includes('mentor')
    ) {
      resolvedRole = 'supervisor'
    }

    const localPart = normalizedEmail.split('@')[0] || 'User'
    const displayName = localPart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    const sessionUser = {
      name: displayName,
      email: normalizedEmail,
      role: resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1),
      department: 'Software Engineering',
      program: 'Level 3',
      initials: displayName
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase(),
    }
    localStorage.setItem('internSmart_user', JSON.stringify(sessionUser))

    if (resolvedRole === 'admin') {
      navigate('/admin')
    } else if (resolvedRole === 'supervisor') {
      navigate('/supervisor')
    } else {
      navigate('/student')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    setServerError("");
    setSuccessMessage("");

    const validationErrors = validateForm(values);

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      setLoading(true);

      let backendRole = null

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

        if (response.ok) {
          backendRole = data.role || data.user?.role
          if (data.token) {
            localStorage.setItem('token', data.token)
          }
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user))
          }
        }
      } catch {
        // Backend offline — mock mode
      }

      setTimeout(() => {
        setLoading(false)
        determineRoleAndNavigate(values.email, backendRole)
      }, 400)

    } catch (error) {
      console.error("Login error:", error);

      setServerError(
        error.message || "Unable to login. Please try again."
      );
      setLoading(false)
    }
  };

  return (
    <div className="min-h-screen bg-[#EFF4FA] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          {/* Logo & Header */}
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div>
                <img
                  src={logoImg}
                  alt="InternSmart logo"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5A623] shadow-sm transition group-hover:scale-105"
                />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight text-slate-950">InternSmart</p>
              </div>
            </Link>

            <Link
              to="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
            >
              ← Back
            </Link>
          </div>

          <div className="space-y-2 mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[#071A2D]">
              Welcome <span className="text-[#F5A623]">back</span>
            </h1>
            <p className="text-sm text-slate-600">
              Sign in to continue your internship supervision.
            </p>
          </div>

          {serverError && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
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
                  autoComplete="email"
                  value={values.email}
                  onChange={handleChange}
                  className={`w-full rounded-2xl border bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition ${
                    errors.email
                      ? 'border-red-400 ring-2 ring-red-400/20'
                      : 'border-slate-200 focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20'
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

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={values.password}
                  onChange={handleChange}
                  className={`w-full rounded-2xl border bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition ${
                    errors.password
                      ? 'border-red-400 ring-2 ring-red-400/20'
                      : 'border-slate-200 focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20'
                  }`}
                  placeholder="Enter your password"
                />
                {/* <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button> */}
              </div>
              {errors.password && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>
             <button
                  type="button"
                  onClick={() => alert('Please contact your administrator to reset your password.')}
                  className="text-xs font-semibold text-[#F5A623] hover:text-[#e69d1b] transition cursor-pointer relative left-60"
                >
                  Forgot password?
                </button>

            {/* Submit Button */}
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

          {/* Administrator notice (no user self sign-up) */}
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

export default Login;