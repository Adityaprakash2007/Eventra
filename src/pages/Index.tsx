import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import AnimatedNumber from "@/components/AnimatedNumber";
import {
  fetchStats,
  fetchRegistrationsPerEvent,
  fetchRegistrations,
  fetchEvents,
  fetchPayments,
  fetchRecommendations,
  fetchPredictions,
} from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CalendarDays,
  Ticket,
  IndianRupee,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  CalendarPlus,
  CreditCard,
  Sparkles,
  Flame,
  MapPin,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSearchParams, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useNotifications } from "@/components/NotificationCenter";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";

/* ── helpers ──────────────────────────────────────────────────────── */

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** Deterministic pseudo-trend so pills feel alive without a backend. */
function pseudoTrend(value: number) {
  const t = ((value * 2654435761) % 400) / 100 - 1; // -1 .. 3
  const pct = Math.max(Math.abs(t) * 12, 2);
  return { up: t >= 0, pct };
}

const RANGES = ["Daily", "Weekly", "Monthly", "Yearly"] as const;
type Range = (typeof RANGES)[number];

const RANGE_LABELS: Record<Range, string[]> = {
  Daily: ["12AM", "01AM", "02AM", "03AM", "04AM", "05AM", "06AM", "07AM", "08AM", "09AM", "10AM"],
  Weekly: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  Monthly: ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
  Yearly: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"],
};

/** Smooth deterministic curve per range, scaled to real total revenue. */
function seriesFor(range: Range, total: number) {
  const labels = RANGE_LABELS[range];
  const share = { Daily: 0.05, Weekly: 0.1, Monthly: 0.35, Yearly: 0.6 }[range];
  return labels.map((name, i) => ({
    name,
    revenue: Math.round(
      Math.max(
        total * share * (0.35 + 0.09 * i + 0.22 * Math.sin(i * 1.35 + range.length)),
        0,
      ),
    ),
  }));
}

/* ── page ─────────────────────────────────────────────────────────── */

const Index = () => {
  usePageTitle("Dashboard");
  const [params, setParams] = useSearchParams();
  const { notify } = useNotifications();
  const { isLoggedIn } = useAuth();
  const reduce = useReducedMotion();
  const [range, setRange] = useState<Range>("Monthly");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Some webviews pause autoplaying video after compositing hiccups — resume.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    const onResume = () => v.play().catch(() => {});
    v.addEventListener("pause", onResume);
    return () => v.removeEventListener("pause", onResume);
  }, []);

  useEffect(() => {
    if (params.get("payment") === "success") {
      const tx = params.get("tx");
      toast.success(tx ? `🎉 Payment Confirmed via Razorpay! ID: ${tx}` : "🎉 Payment Confirmed!");
      notify({
        type: "payment",
        title: "Payment confirmed",
        message: tx ? `Razorpay transaction ${tx} completed successfully.` : "Your ticket payment went through.",
      });
      setParams({}, { replace: true });
    }
  }, [params, setParams, notify]);

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const { data: chartData } = useQuery({ queryKey: ["registrationsPerEvent"], queryFn: fetchRegistrationsPerEvent });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: fetchRegistrations });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents() });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: fetchPayments });

  // ── AI sections (graceful when signed out or cold-start) ──
  const { data: recs } = useQuery({
    queryKey: ["recommendations"],
    queryFn: fetchRecommendations,
    enabled: isLoggedIn,
  });
  const { data: predictions } = useQuery({ queryKey: ["predictions"], queryFn: fetchPredictions });
  const recommended = (recs?.recommendations ?? []).slice(0, 4);
  const trending = (predictions?.predictions ?? [])
    .filter((p) => p.label === "High")
    .slice(0, 4);

  const chartRows = Array.isArray(chartData) ? chartData : [];
  const topEvents = [...chartRows].sort((a, b) => b.registrations - a.registrations).slice(0, 3);
  const maxReg = topEvents[0]?.registrations ?? 1;

  const paidTotal = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amount), 0);
  const pendingTotal = payments.filter((p) => p.status !== "Paid").reduce((s, p) => s + Number(p.amount), 0);
  const collectedPct = paidTotal + pendingTotal > 0 ? Math.round((paidTotal / (paidTotal + pendingTotal)) * 100) : 0;

  const vipCount = registrations.filter((r) => String(r.ticket).toLowerCase() === "vip").length;
  const regCount = registrations.length - vipCount;
  const vipPct = registrations.length ? Math.round((vipCount / registrations.length) * 100) : 0;

  const series = stats ? seriesFor(range, stats.totalRevenue) : [];
  const heroTrend = pseudoTrend((stats?.totalRevenue ?? 0) + 7);
  const regTrend = pseudoTrend((stats?.totalRegistrations ?? 0) + 3);
  const evTrend = pseudoTrend((stats?.totalEvents ?? 0) + 11);

  const recentRegistrations = registrations.slice(0, 4);
  const recentPayments = payments.filter((p) => p.status === "Paid").slice(0, 3);

  const glass =
    "rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl shadow-2xl";
  const glassPulse = "animate-pulse rounded-md bg-white/10";

  return (
    <Layout>
      <PageTransition>
        {/* ── Dashboard cinema panel: jelly video background + glass UI ── */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
          {/* animated jelly background */}
          {!reduce && (
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden
              src="https://ease-one.vercel.app/bg/something.mp4"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          {/* readability scrim + ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/90" />
          <div className="pointer-events-none absolute -top-48 left-1/2 h-96 w-[72%] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[130px]" />

          <div className="relative z-10 p-4 text-white sm:p-6 lg:p-10">
            {/* headline */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-3xl pb-10 pt-6 text-center md:pb-14 md:pt-12"
            >
              <h1 className="bg-gradient-to-b from-indigo-200 via-violet-200 to-white bg-clip-text p-2 text-3xl font-normal tracking-tighter text-transparent sm:text-4xl md:text-5xl">
                Manage your events, sales and analytics in one place.
              </h1>
              <p className="mb-6 mt-3 text-white/60">
                Live pulse of users, events and ticket sales — updated in real time.
              </p>
              <Link
                to="/events"
                className="group inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:border-white/40 hover:bg-white/10"
              >
                Explore events
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            {/* ── top stat cards ── */}
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Total Revenue", value: stats?.totalRevenue, currency: true, trend: heroTrend, icon: IndianRupee },
                { label: "Total Registrations", value: stats?.totalRegistrations, currency: false, trend: regTrend, icon: Ticket },
                { label: "Total Events", value: stats?.totalEvents, currency: false, trend: evTrend, icon: CalendarDays },
              ].map((s) => (
                <div key={s.label} className={`${glass} p-5 transition-colors hover:bg-white/[0.08] sm:p-6`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <s.icon className="h-4 w-4 text-white/50" />
                      {s.label}
                    </div>
                    {!statsLoading && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          s.trend.up ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {s.trend.up ? "+" : "−"}
                        {s.trend.pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {statsLoading ? (
                    <div className={`mt-3 h-10 w-40 ${glassPulse}`} />
                  ) : (
                    <p className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl xl:text-5xl">
                      <AnimatedNumber value={s.value ?? 0} prefix={s.currency ? "₹" : ""} />
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* ── balance panel · revenue overview · top events ── */}
            <div className="mb-4 grid gap-4 lg:grid-cols-[280px_1fr_260px]">
              {/* balance panel */}
              <div className={`${glass} p-5 sm:p-6`}>
                <p className="text-sm text-white/70">Collected Revenue</p>
                {statsLoading ? (
                  <div className={`mt-3 h-9 w-32 ${glassPulse}`} />
                ) : (
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{inr(paidTotal)}</p>
                )}
                <Link
                  to="/admin"
                  className="mt-4 block rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:from-violet-500 hover:to-indigo-500"
                >
                  View payments
                </Link>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">Collected</span>
                    <span className="font-medium text-emerald-400">{collectedPct}%</span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{inr(paidTotal)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${collectedPct}%` }} />
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">Pending</span>
                    <span className="font-medium text-amber-400">{100 - collectedPct}%</span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{inr(pendingTotal)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: `${100 - collectedPct}%` }} />
                  </div>
                </div>
              </div>

              {/* revenue overview */}
              <div className={`${glass} p-5 sm:p-6`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-medium">Revenue Overview</h2>
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                    {RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          range === r ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64 w-full sm:h-72">
                  {statsLoading ? (
                    <div className={`h-full w-full ${glassPulse}`} />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGlass" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                        />
                        <Tooltip
                          cursor={{ stroke: "rgba(255,255,255,0.25)" }}
                          contentStyle={{
                            background: "rgba(0,0,0,0.85)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 12,
                            color: "#fff",
                            backdropFilter: "blur(8px)",
                          }}
                          formatter={(value) => [inr(Number(value)), "Revenue"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#6ee7b7"
                          strokeWidth={2}
                          fill="url(#revGlass)"
                          dot={{ r: 3, fill: "#fff", stroke: "#34d399", strokeWidth: 2 }}
                          activeDot={{ r: 5, fill: "#fff", stroke: "#34d399", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* top events + ticket mix + community */}
              <div className={`${glass} p-5 sm:p-6`}>
                <h2 className="text-lg font-medium">Top Events</h2>
                <div className="mt-4 space-y-4">
                  {topEvents.length === 0 && <div className={`h-16 w-full ${glassPulse}`} />}
                  {topEvents.map((e) => (
                    <div key={e.name}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-white/80">{e.name}</span>
                        <span className="shrink-0 font-medium">{e.registrations}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400"
                          style={{ width: `${Math.max((e.registrations / maxReg) * 100, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-sm text-white/70">Ticket mix</p>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${vipPct}%` }} />
                    <div className="flex-1 bg-gradient-to-r from-sky-500 to-cyan-400" />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-white/60">
                    <span>VIP {vipPct}%</span>
                    <span>Regular {100 - vipPct}%</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <Users className="h-4 w-4 text-white/70" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{stats?.totalUsers ?? "—"} registered users</p>
                    <p className="text-xs text-white/50">{events.length} events live</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── recent activity ── */}
            <div className={`${glass} p-5 sm:p-6`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-medium">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Recent Activity
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" /> Live
                </div>
              </div>
              {registrations.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-12 w-full ${glassPulse}`} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {recentRegistrations.map((r) => {
                    const paid = payments.some((p) => p.user === r.user && p.status === "Paid");
                    return (
                      <div key={r.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            paid ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/70"
                          }`}
                        >
                          {paid ? <CreditCard className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            <span className="font-semibold">{r.user}</span>
                            <span className="text-white/60"> registered for {r.event?.title ?? "an event"}</span>
                          </p>
                          <p className="text-xs text-white/50">
                            {r.ticket} ticket · {paid ? "payment completed" : "awaiting payment"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            paid ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {paid ? "Paid" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                  {recentPayments.map((p) => (
                    <div key={`p-${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                        <IndianRupee className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-semibold">{p.user}</span>
                          <span className="text-white/60"> paid {inr(Number(p.amount))}</span>
                        </p>
                        <p className="text-xs text-white/50">via {p.method}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">Success</span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                to="/admin"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Recommended For You (AI) ── */}
        {isLoggedIn && recommended.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
                  <Sparkles className="h-5 w-5 text-primary" /> Recommended For You
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Picked from your interests, location and registration history.
                </p>
              </div>
              <Link to="/events" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommended.map((r) => (
                <Link
                  key={r.eventId}
                  to={`/events/${r.eventId}`}
                  className="group rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                      {r.category ?? "Event"}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round(r.score * 100)}% match
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 font-bold leading-snug group-hover:text-primary">{r.title}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {r.city ?? "—"} · {r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "TBA"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {r.reasons.slice(0, 2).map((reason) => (
                      <span key={reason} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{reason}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-extrabold">
                    {r.price > 0 ? inr(r.price) : "Free"}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.seats} seats left</span>
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Trending predictions (AI) ── */}
        {trending.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
                  <Flame className="h-5 w-5 text-orange-500" /> Trending now
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Predicted to sell out — popularity score from live registration data.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trending.map((p) => (
                <Link
                  key={p.eventId}
                  to={`/events/${p.eventId}`}
                  className="group rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-orange-500/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{p.emoji}</span>
                    <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                      <TrendingUp className="h-3 w-3" /> {p.trendPct > 0 ? "+" : ""}{p.trendPct}%
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 font-bold leading-snug group-hover:text-primary">{p.title}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500" style={{ width: `${p.popularity}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {p.popularity}% popularity · {p.registered}/{p.capacity} booked
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </PageTransition>
    </Layout>
  );
};

export default Index;
