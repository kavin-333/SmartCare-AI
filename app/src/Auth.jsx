import { useState } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "")
).replace(/\/$/, "");

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function Auth({ onAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setError("");
    setSuccess("");
  }

  function switchMode() {
    setIsLogin(!isLogin);

    setFormData({
      name: "",
      email: "",
      phoneNumber: "",
      password: "",
    });

    setError("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!API_BASE_URL && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
        throw new Error(
          "Backend API URL is not configured. Please set VITE_API_BASE_URL in your Vercel project Settings → Environment Variables, then redeploy."
        );
      }

      const endpoint = isLogin
        ? "/api/auth/login"
        : "/api/auth/register";

      const normalizedPhoneNumber = formData.phoneNumber
        .replace(/[\s()-]/g, "")
        .trim();

      const body = isLogin
        ? {
            email: formData.email,
            password: formData.password,
          }
        : {
            name: formData.name,
            email: formData.email,
            phoneNumber: normalizedPhoneNumber,
            password: formData.password,
          };

      const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        let message = "";
        if (typeof data === "object" && data !== null) {
          message = data.message || (typeof data.error === "string" ? data.error : data.error?.message);
        } else if (typeof data === "string" && data.trim()) {
          message = data.startsWith("<")
            ? `Server returned HTTP ${response.status} (${response.statusText || "Error"})`
            : data;
        }

        if (!message) {
          message = `Server returned HTTP ${response.status} (${response.statusText || "Request failed"})`;
        }

        throw new Error(message);
      }

      // =================================================
      // REGISTRATION SUCCESS
      // =================================================

      if (!isLogin) {
        setSuccess(
          "Registration successful! You can now log in."
        );

        setIsLogin(true);

        setFormData({
          name: "",
          email: formData.email,
          phoneNumber: "",
          password: "",
        });

        return;
      }

      // =================================================
      // LOGIN SUCCESS
      // =================================================

      if (!data.token || !data.user) {
        throw new Error(
          "Login succeeded but the server did not return authentication details."
        );
      }

      localStorage.setItem("token", data.token);

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      if (onAuthenticated) {
        onAuthenticated(data.user);
      }
    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      setError(
        error instanceof TypeError
          ? "Unable to connect to SmartCare backend. Make sure the backend is running on port 8000."
          : error.message ||
              "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/20">
            <span className="text-3xl">🏥</span>
          </div>

          <h1 className="text-3xl font-bold text-white">
            SmartCare AI
          </h1>

          <p className="text-slate-400 mt-2">
            Smart healthcare appointment management
          </p>
        </div>

        {/* =================================================
            AUTH CARD
        ================================================= */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">
              {isLogin
                ? "Welcome Back"
                : "Create Account"}
            </h2>

            <p className="text-slate-400 mt-1">
              {isLogin
                ? "Login to manage your appointments."
                : "Register to book and manage appointments."}
            </p>
          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* =================================================
              SUCCESS
          ================================================= */}

          {success && (
            <div className="mb-5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* =================================================
                NAME - REGISTER ONLY
            ================================================= */}

            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Full Name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {/* =================================================
                EMAIL
            ================================================= */}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Email Address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* =================================================
                PHONE NUMBER - REGISTER ONLY
            ================================================= */}

            {!isLogin && (
              <div>
                <label
                  htmlFor="phoneNumber"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Phone Number
                </label>

                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="+91 9876543210"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />

                <p className="text-xs text-slate-500 mt-2">
                  Include your country code. Example: +91 9876543210
                </p>
              </div>
            )}

            {/* =================================================
                PASSWORD
            ================================================= */}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                minLength={6}
                autoComplete={
                  isLogin
                    ? "current-password"
                    : "new-password"
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />

              {!isLogin && (
                <p className="text-xs text-slate-500 mt-2">
                  Password must contain at least 6 characters.
                </p>
              )}
            </div>

            {/* =================================================
                SUBMIT
            ================================================= */}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login"
                : "Create Account"}
            </button>
          </form>

          {/* =================================================
              SWITCH LOGIN / REGISTER
          ================================================= */}

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}

              <button
                type="button"
                onClick={switchMode}
                className="ml-2 font-semibold text-blue-400 hover:text-blue-300"
              >
                {isLogin
                  ? "Create Account"
                  : "Login"}
              </button>
            </p>
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <p className="text-center text-xs text-slate-600 mt-6">
          SmartCare AI • Secure Healthcare Management
        </p>
      </div>
    </div>
  );
}

export default Auth;