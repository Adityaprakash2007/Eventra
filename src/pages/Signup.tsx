import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Zap, Loader2, Chrome, Github, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const socialButtons = [
  { icon: Chrome, label: "Google" },
  { icon: Github, label: "GitHub" },
  { icon: Linkedin, label: "LinkedIn" },
];

function getPasswordScore(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = [
    "bg-rose-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-500",
  ];
  return { score, label: labels[score], color: colors[score] };
}

export default function Signup() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  // Hooks must run unconditionally — the signed-in branch below just renders
  // over them. (Conditional useState violates the rules of hooks.)
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in? No need to create another account.
  if (isLoggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-card auth-success">
          ✅ You already have an account and are signed in.
          <p className="mt-3">
            <Link to="/" className="auth-link">Go to the dashboard</Link>
          </p>
        </div>
      </div>
    );
  }

  const strength = getPasswordScore(form.password);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
          <span className="auth-logo-text">Eventra</span>
        </div>

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">Join Eventra and start discovering events</p>

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

            {/* Password strength meter */}
            {form.password && (
              <div className="mt-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-300",
                        i < strength.score ? strength.color : "bg-slate-700"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Strength: <span className="font-medium text-slate-300">{strength.label}</span>
                  {strength.score < 3 && " — try a longer mix of letters, numbers & symbols"}
                </p>
              </div>
            )}
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
            {form.confirm && form.password && (
              <p className={cn("text-[11px]", form.confirm === form.password ? "text-emerald-400" : "text-rose-400")}>
                {form.confirm === form.password ? "✓ Passwords match" : "✗ Passwords don't match yet"}
              </p>
            )}
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <Loader2 size={18} className="auth-spinner" /> : "Create Account"}
          </button>
        </form>

        {/* Social signup placeholders */}
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-slate-500">or sign up with</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {socialButtons.map((s) => (
              <button
                key={s.label}
                type="button"
                title={`${s.label} sign-up (coming soon)`}
                onClick={() => setError(`${s.label} sign-up is coming soon. Use your email for now.`)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 py-2 text-xs font-medium text-slate-300 transition-all hover:border-slate-500 hover:text-white"
              >
                <s.icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
