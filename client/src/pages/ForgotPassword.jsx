import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  ArrowLeft,
  Check,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import api from "../api/axios";

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess(false);

    // Email validation
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
      const response = await api.post("/users/forgot-password", {
        email: email.trim(),
      });

      setSuccess(true);
    } catch (error) {
      console.error("FORGOT PASSWORD ERROR:", error);

      setError(
        error.response?.data?.message || "Unable to send reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

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
              <Mail className="h-7 w-7 text-[#F5A623]" />
            </div>

            <h1 className="text-2xl font-bold text-[#071A2D]">
              Forgot Password?
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3.5 text-xs text-green-700">
              <Check className="h-4 w-4 text-green-500" />
              <span>
                Password reset email sent! Please check your inbox and follow the instructions.
              </span>
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
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
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className={`w-full rounded-2xl border bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition ${
                      error
                        ? "border-red-400 ring-2 ring-red-400/20"
                        : "border-slate-200 focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
                    }`}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#F5A623] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#e69d1b] shadow-[0_10px_25px_rgba(245,166,35,0.3)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          ) : (
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
