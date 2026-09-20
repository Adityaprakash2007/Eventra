import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Zap, Loader2 } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "srmist.edu.in"];

  const isEmailAllowed = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return ALLOWED_EMAIL_DOMAINS.includes(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailAllowed(form.email)) {
      setError("Only @gmail.com, @yahoo.com, or @srmist.edu.in emails are accepted.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      navigate("/login?registered=1");
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

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">Join EventFlow and start discovering events</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="signup-name" className="auth-label">Full Name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Jane Doe"
              value={form.name}
              onChange={handleChange}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="signup-email" className="auth-label">Email</label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="signup-password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Min. 6 characters"
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

          <div className="auth-field">
            <label htmlFor="signup-confirm" className="auth-label">Confirm Password</label>
            <input
              id="signup-confirm"
              name="confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
              value={form.confirm}
              onChange={handleChange}
              className="auth-input"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <Loader2 size={18} className="auth-spinner" /> : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
