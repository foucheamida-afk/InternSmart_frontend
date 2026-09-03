import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

const ChangePassword = () => {
  const navigate = useNavigate();

  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Live password requirements
  const passwordRules = {
    minLength: values.newPassword.length >= 6,
    uppercase: /[A-Z]/.test(values.newPassword),
    lowercase: /[a-z]/.test(values.newPassword),
    number: /\d/.test(values.newPassword),
    special: /[!@#$%^&*]/.test(values.newPassword),
  };

  const passwordIsValid =
    passwordRules.minLength &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number &&
    passwordRules.special;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");

    // Check token
    if (!token) {
      setError(
        "Your session has expired. Please login again."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1500);

      return;
    }

    // Current password
    if (!values.currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    // Password requirements
    if (!passwordIsValid) {
      setError(
        "Your new password does not meet all the requirements."
      );
      return;
    }

    // Confirm password
    if (!values.confirmPassword) {
      setError("Please confirm your new password.");
      return;
    }

    if (
      values.newPassword !== values.confirmPassword
    ) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/users/change-password",
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",

            // JWT goes here
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            confirmPassword: values.confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to change password."
        );
        return;
      }

      setSuccess(
        "Password changed successfully!"
      );

      // Update local user information
      const user = JSON.parse(
        localStorage.getItem("user")
      );

      if (user) {
        user.mustChangePassword = false;

        localStorage.setItem(
          "user",
          JSON.stringify(user)
        );
      }

      // Redirect after successful change
      setTimeout(() => {
        const user = JSON.parse(
          localStorage.getItem("user")
        );

        switch (user?.role) {
          case "student":
            navigate("/student/dashboard");
            break;

            case "academic_supervisor":
              navigate(
                "/supervisor"
              );
              break;

            case "professional_supervisor":
              navigate(
                "/professional-supervisor"
              );
              break;

            case "admin":
              navigate("/admin/dashboard");
              break;

           default:
             navigate("/");
         }
      }, 1000);

    } catch (error) {
      console.error(
        "CHANGE PASSWORD ERROR:",
        error
      );

      setError(
        "Unable to connect to the server."
      );

    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({
    valid,
    children,
  }) => (
    <div
      className={`flex items-center gap-2 text-sm ${
        valid
          ? "text-green-600"
          : "text-red-500"
      }`}
    >
      {valid ? (
        <Check className="h-4 w-4" />
      ) : (
        <X className="h-4 w-4" />
      )}

      <span>{children}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-md">

        <div className="rounded-3xl bg-white p-8 shadow-xl border border-slate-100">

          {/* Header */}
          <div className="mb-8 text-center">

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5A623]/10">
              <Lock className="h-7 w-7 text-[#F5A623]" />
            </div>

            <h1 className="text-2xl font-bold text-[#0B1F33]">
              Change Your Password
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              You must create a new password before continuing.
            </p>

          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">

              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

              <span>{error}</span>

            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-600">

              <Check className="h-4 w-4" />

              <span>{success}</span>

            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >

            {/* Current Password */}
            <div>

              <label
                htmlFor="currentPassword"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Current Password
              </label>

              <div className="relative">

                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={
                    values.currentPassword
                  }
                  onChange={handleChange}
                  placeholder="Enter current password"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
                />

              </div>

            </div>

            {/* New Password */}
            <div>

              <label
                htmlFor="newPassword"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                New Password
              </label>

              <div className="relative">

                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={values.newPassword}
                  onChange={handleChange}
                  placeholder="Create a new password"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
                />

              </div>

              {/* Live requirements */}
              <div className="mt-3 rounded-2xl bg-slate-50 p-4">

                <p className="mb-3 text-xs font-semibold text-slate-600">
                  Password requirements
                </p>

                <div className="space-y-2">

                  <Requirement
                    valid={
                      passwordRules.minLength
                    }
                  >
                    At least 6 characters
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRules.uppercase
                    }
                  >
                    At least one uppercase letter
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRules.lowercase
                    }
                  >
                    At least one lowercase letter
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRules.number
                    }
                  >
                    At least one number
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRules.special
                    }
                  >
                    At least one special character
                  </Requirement>

                </div>

              </div>

            </div>

            {/* Confirm Password */}
            <div>

              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Confirm New Password
              </label>

              <div className="relative">

                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={
                    values.confirmPassword
                  }
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#0B1F33] focus:ring-2 focus:ring-[#F5A623]/20"
                />

              </div>

              {values.confirmPassword && (
                <div
                  className={`mt-2 flex items-center gap-2 text-sm ${
                    values.newPassword ===
                    values.confirmPassword
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {values.newPassword ===
                  values.confirmPassword ? (
                    <>
                      <Check className="h-4 w-4" />
                      Passwords match
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Passwords do not match
                    </>
                  )}
                </div>
              )}

            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#0B1F33] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0B1F33]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Changing Password..."
                : "Change Password"}
            </button>

          </form>

        </div>

      </div>

    </div>
  );
};

export default ChangePassword;