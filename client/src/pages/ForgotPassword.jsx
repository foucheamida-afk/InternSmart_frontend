import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  ArrowLeft,
  Check,
  AlertCircle,
  LoaderCircle,
  KeyRound,
  Lock,
  RotateCcw,
} from "lucide-react";
import api from "../api/axios";

// Password recovery is a three-step OTP flow:
//   1. email      -> request a 6-digit code (emailed, valid 15 minutes)
//   2. code       -> exchange the code for a short-lived reset token
//   3. reset      -> choose a new password using that token
const STEPS = { EMAIL: "email", CODE: "code", RESET: "reset", DONE: "done" };

const passwordRequirements = [
  { label: "At least 6 characters long", test: (p) => p.length >= 6 },
  { label: "Contains at least one uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains at least one lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains at least one number", test: (p) => /[0-9]/.test(p) },
  { label: "Contains at least one special character (!@#$%^&*)", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const Requirement = ({ valid, children }) => (
  <div className="flex items-center gap-2 text-xs">
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
        valid ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
      }`}
    >
      <Check size={11} />
    </span>
    <span className={valid ? "text-green-700" : "text-slate-500"}>{children}</span>
  </div>
);

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [values, setValues] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordIsValid = passwordRequirements.every((req) => req.test(values.newPassword));

  const resetMessages = () => {
    setError("");
  };

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
    resetMessages();
  };

  // Step 1 — request a code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/users/forgot-password", { email: email.trim().toLowerCase() });
      setStep(STEPS.CODE);
      setCode("");
    } catch (err) {
      console.error("FORGOT PASSWORD ERROR:", err);
      setError(err.response?.data?.message || "Unable to send the reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — exchange the code for a reset token
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/users/verify-otp", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      setResetToken(response.data.resetToken);
      setStep(STEPS.RESET);
    } catch (err) {
      console.error("VERIFY OTP ERROR:", err);
      setError(err.response?.data?.message || "Unable to verify that code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — set the new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!passwordIsValid) {
      setError("Your new password does not meet the requirements below.");
      return;
    }

    if (values.newPassword !== values.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/users/reset-password", {
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      setStep(STEPS.DONE);
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      setError(err.response?.data?.message || "Unable to reset your password. Please start again.");
    } finally {
      setLoading(false);
    }
  };

  const heading = {
    [STEPS.EMAIL]: {
      title: "Forgot Password?",
      body: "Enter your email address and we'll send you a 6-digit reset code.",
      icon: <Mail className="h-7 w-7 text-[#F5A623]" />,
    },
    [STEPS.CODE]: {
      title: "Enter Reset Code",
      body: `We sent a 6-digit code to ${email}. It expires in 15 minutes.`,
      icon: <KeyRound className="h-7 w-7 text-[#F5A623]" />,
    },
    [STEPS.RESET]: {
      title: "Choose a New Password",
      body: "Your code was verified. Set a new password for your account.",
      icon: <Lock className="h-7 w-7 text-[#F5A623]" />,
    },
    [STEPS.DONE]: {
      title: "Password Reset",
      body: "Your password has been changed. You can now log in.",
      icon: <Check className="h-7 w-7 text-[#F5A623]" />,
    },
  }[step];

  const inputClass = (hasError) =>
    `w-full rounded-2xl border bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition ${
      hasError
        ? "border-red-400 ring-2 ring-red-400/20"
        : "border-slate-200 focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
    }`;

  const submitButton = (label, busyLabel) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-2xl bg-[#F5A623] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#e69d1b] shadow-[0_10px_25px_rgba(245,166,35,0.3)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {busyLabel}
        </>
      ) : (
        label
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#EFF4FA] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">

          {/* Back Button */}
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#F5A623] hover:text-[#e69d1b] transition"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>

          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5A623]/10">
              {heading.icon}
            </div>
            <h1 className="text-2xl font-bold text-[#071A2D]">{heading.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{heading.body}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1 — email */}
          {step === STEPS.EMAIL && (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); resetMessages(); }}
                    placeholder="Enter your email address"
                    className={inputClass(!!error)}
                  />
                </div>
              </div>
              {submitButton("Send Reset Code", "Sending...")}
            </form>
          )}

          {/* Step 2 — code */}
          {step === STEPS.CODE && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label htmlFor="code" className="mb-2 block text-sm font-semibold text-slate-700">
                  6-digit reset code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); resetMessages(); }}
                    placeholder="123456"
                    className={`${inputClass(!!error)} tracking-[0.4em]`}
                  />
                </div>
              </div>

              {submitButton("Verify Code", "Verifying...")}

              <button
                type="button"
                onClick={() => { setStep(STEPS.EMAIL); setError(""); setCode(""); }}
                className="mx-auto flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#F5A623] transition"
              >
                <RotateCcw size={13} />
                Use a different email or resend the code
              </button>
            </form>
          )}

          {/* Step 3 — new password */}
          {step === STEPS.RESET && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={values.newPassword}
                    onChange={handleChange}
                    placeholder="Enter a new password"
                    className={inputClass(!!error)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={values.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter the new password"
                    className={inputClass(!!error)}
                  />
                </div>
              </div>

              {/* Live requirements */}
              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="mb-3 text-xs font-semibold text-slate-600">Password requirements</p>
                <div className="space-y-2">
                  {passwordRequirements.map((req) => (
                    <Requirement key={req.label} valid={req.test(values.newPassword)}>
                      {req.label}
                    </Requirement>
                  ))}
                </div>
              </div>

              {submitButton("Reset Password", "Resetting...")}
            </form>
          )}

          {/* Done */}
          {step === STEPS.DONE && (
            <button
              onClick={() => navigate("/login")}
              className="w-full rounded-2xl bg-[#F5A623] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#e69d1b] shadow-[0_10px_25px_rgba(245,166,35,0.3)] cursor-pointer"
            >
              Back to Login
            </button>
          )}

          {/* Administrator Notice */}
          <div className="mt-5 p-3.5 text-center text-xs text-slate-600">
            <p>
              If you don't receive an email within a few minutes, please check your spam folder or contact your administrator.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
