import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStats, fetchRegistrationsPerEvent } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Users, CalendarDays, Ticket, IndianRupee, TrendingUp, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

const tones = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
];
const icons = [Users, CalendarDays, Ticket, IndianRupee];
const labels = ["Total Users", "Total Events", "Total Registrations", "Total Revenue"];

const Index = () => {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("payment") === "success") {
      const tx = params.get("tx");
      toast.success(
        tx ? `🎉 Payment Confirmed via Razorpay! ID: ${tx}` : "🎉 Payment Confirmed!"
      );
      // Clean up search params after toast
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["registrationsPerEvent"],
    queryFn: fetchRegistrationsPerEvent,
  });

  const summaryValues = stats
    ? [stats.totalUsers, stats.totalEvents, stats.totalRegistrations, `₹${stats.totalRevenue.toLocaleString()}`]
    : [0, 0, 0, "₹0"];

  const summary = labels.map((label, i) => ({
    label,
    value: summaryValues[i],
    icon: icons[i],
    tone: tones[i],
  }));

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of users, events, and ticket sales.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {summary.map(s => (
          <Card key={s.label} className="overflow-hidden border-border/60 shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  {statsLoading ? (
                    <Loader2 className="h-6 w-6 mt-2 animate-spin text-muted-foreground" />
                  ) : (
                    <p className="text-2xl font-bold mt-2">{s.value}</p>
                  )}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${s.tone} text-white shadow-sm`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Registrations per Event</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Live breakdown of ticket sign-ups</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">Live</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    cursor={{ fill: "hsl(var(--accent))" }}
                  />
                  <Bar dataKey="registrations" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
};

export default Index;
