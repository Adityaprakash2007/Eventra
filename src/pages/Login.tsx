import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Zap, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "srmist.edu.in"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = form.email.split("@")[1]?.toLowerCase();
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      setError("Only @gmail.com, @yahoo.com, or @srmist.edu.in emails are accepted.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      login(data);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Animated background orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Zap size={22} />
          </div>
          <span className="auth-logo-text">EventFlow</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account to continue</p>

        {justRegistered && (
          <p className="auth-success">✅ Account created! Please sign in.</p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="login-email" className="auth-label">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@gmail.com / @yahoo.com / @srmist.edu.in"
              value={form.email}
              onChange={handleChange}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password" className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="login-password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className="auth-input auth-input-pw"
              />
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <Loader2 size={18} className="auth-spinner" /> : "Sign In"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/signup" className="auth-link">Create one</Link>
        </p>
      </div>
    </div>
  );
}
