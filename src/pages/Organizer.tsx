import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  fetchOrganizerOverview, fetchEvents, fetchAttendees, sendAnnouncement, promoteWaitlist,
  fetchEventWaitlist, type OrganizerOverview, type Event,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IndianRupee, Ticket, UserCheck, Percent, TrendingUp, Megaphone, Download,
  Search, ScanLine, Users, Loader2, Send, Star, Crown, Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded`);
}

function StatCard({ label, value, icon: Icon, sub, tint }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; tint?: string;
}) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tint ?? "bg-primary/10")}>
            <Icon className="h-4 w-4 text-primary" />
          </div>
          {label}
        </div>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Organizer() {
  usePageTitle("Organizer");
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin } = useAuth();

  const { data: overview, isLoading } = useQuery({
    queryKey: ["organizerOverview"],
    queryFn: fetchOrganizerOverview,
    enabled: isLoggedIn,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
    enabled: isLoggedIn,
  });

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annWaitlist, setAnnWaitlist] = useState(false);

  const { data: attendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ["attendees", selectedEventId],
    queryFn: () => fetchAttendees(selectedEventId!),
    enabled: !!selectedEventId,
  });

  const { data: waitlistRows = [] } = useQuery({
    queryKey: ["eventWaitlist", selectedEventId],
    queryFn: () => fetchEventWaitlist(selectedEventId!),
    enabled: !!selectedEventId,
  });

  const announceMut = useMutation({
    mutationFn: () => sendAnnouncement(selectedEventId!, { title: annTitle, message: annMessage, includeWaitlist: annWaitlist }),
    onSuccess: (r) => {
      toast.success(`Announcement sent to ${r.reached} attendee${r.reached === 1 ? "" : "s"}`);
      setAnnounceOpen(false);
      setAnnTitle("");
      setAnnMessage("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not send announcement"),
  });

  const queryClient = useQueryClient();
  const promoteMut = useMutation({
    mutationFn: () => promoteWaitlist(selectedEventId!),
    onSuccess: (r) => {
      toast.success(r.promoted > 0 ? `Promoted ${r.promoted} attendee(s) from the waitlist` : "No seats free to promote into");
      void queryClient.invalidateQueries({ queryKey: ["eventWaitlist", selectedEventId] });
      void queryClient.invalidateQueries({ queryKey: ["organizerOverview"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Promotion failed"),
  });

  const filteredAttendees = useMemo(() => {
    const q = attendeeQuery.trim().toLowerCase();
    return attendees.filter((a) => {
      const matchesQ = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || String(a.ticketCode || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "checked_in" && a.checkedInAt) ||
        (statusFilter === "pending" && !a.checkedInAt);
      return matchesQ && matchesStatus;
    });
  }, [attendees, attendeeQuery, statusFilter]);

  if (!isLoggedIn) {
    return (
      <Layout>
        <PageTransition>
          <EmptyState
            icon="calendar"
            title="Sign in to open the organizer console"
            description="Analytics, attendee management and announcements for your events live here."
            actionLabel="Sign in"
            onAction={() => navigate("/login?next=/organizer")}
          />
        </PageTransition>
      </Layout>
    );
  }

  const sum = overview?.summary;
  const growth = (overview?.growth ?? []).map((g) => ({ ...g, label: g.label.replace("W-", "Week ") }));

  return (
    <Layout>
      <PageTransition>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Organizer <span className="gradient-text">Studio</span>
            </h1>
            <p className="mt-1 text-muted-foreground">Revenue, attendance and attendee management for your events.</p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/scanner")}>
            <ScanLine className="h-4 w-4" /> Open Ticket Scanner
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/60" />)}
          </div>
        ) : (
          <>
            {/* ── KPI cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Revenue" value={inr(sum?.totalRevenue ?? 0)} icon={IndianRupee} sub="from completed payments" />
              <StatCard label="Registrations" value={sum?.totalRegistrations ?? 0} icon={Ticket} sub={`across ${sum?.totalEvents ?? 0} events`} />
              <StatCard label="Attendance" value={sum?.totalCheckedIn ?? 0} icon={UserCheck} sub={`${sum?.avgAttendance ?? 0}% average rate`} tint="bg-emerald-500/10" />
              <StatCard label="Conversion" value={`${sum?.avgConversion ?? 0}%`} icon={Percent} sub="capacity filled" tint="bg-amber-500/10" />
            </div>

            {/* ── Charts ── */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                    <TrendingUp className="h-4 w-4 text-primary" /> Registration growth (last 8 weeks)
                  </h2>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={growth} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="orgGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="rgba(120,120,140,0.15)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="registrations" stroke="#6366f1" strokeWidth={2} fill="url(#orgGrowth)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                    <IndianRupee className="h-4 w-4 text-emerald-500" /> Revenue by week
                  </h2>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={growth} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(120,120,140,0.15)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Tabs: events / attendees / predictions ── */}
            <Tabs defaultValue="events" className="mt-6">
              <TabsList>
                <TabsTrigger value="events" className="gap-2">My events</TabsTrigger>
                <TabsTrigger value="attendees" className="gap-2">Attendees</TabsTrigger>
                <TabsTrigger value="waitlist" className="gap-2">Waitlist</TabsTrigger>
              </TabsList>

              {/* Events table */}
              <TabsContent value="events">
                <Card className="border-border/60 shadow-[var(--shadow-card)]">
                  <CardContent className="p-0">
                    {(overview?.perEvent ?? []).length === 0 ? (
                      <div className="p-8">
                        <EmptyState icon="calendar" title="No events yet" description="Create your first event to see analytics here." />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="px-5 py-3 font-semibold">Event</th>
                              <th className="px-5 py-3 font-semibold">Registered</th>
                              <th className="px-5 py-3 font-semibold">Checked in</th>
                              <th className="px-5 py-3 font-semibold">Revenue</th>
                              <th className="px-5 py-3 font-semibold">Rating</th>
                              <th className="px-5 py-3 text-right font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {(overview?.perEvent ?? []).map((e) => (
                              <tr key={e.eventId} className="transition-colors hover:bg-accent/40">
                                <td className="max-w-[240px] px-5 py-3.5">
                                  <p className="truncate font-semibold">{e.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {e.startDate ? new Date(e.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                  </p>
                                </td>
                                <td className="px-5 py-3.5">
                                  <p className="font-semibold">{e.registered}<span className="text-xs font-normal text-muted-foreground">/{e.capacity || "∞"}</span></p>
                                  <Progress value={e.conversionRate} className="mt-1 h-1.5 w-24" />
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="flex items-center gap-1.5">
                                    <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                                    {e.checkedIn}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 font-semibold">{inr(e.revenue)}</td>
                                <td className="px-5 py-3.5">
                                  {e.avgRating != null ? (
                                    <span className="flex items-center gap-1">
                                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                      {e.avgRating}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      size="sm" variant="outline" className="gap-1.5"
                                      onClick={() => downloadCsv(`${e.title.slice(0, 24)}-attendees.csv`, [
                                        ["Name", "Email", "Ticket", "Status", "Checked in", "Amount"],
                                      ])}
                                      title="Full export is available in the Attendees tab"
                                    >
                                      <Download className="h-3.5 w-3.5" /> CSV
                                    </Button>
                                    <Button
                                      size="sm" variant="outline" className="gap-1.5"
                                      onClick={() => { setSelectedEventId(String(e.eventId)); setAnnounceOpen(true); }}
                                    >
                                      <Megaphone className="h-3.5 w-3.5" /> Announce
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Attendee management */}
              <TabsContent value="attendees">
                <Card className="border-border/60 shadow-[var(--shadow-card)]">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select an event…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(overview?.perEvent ?? []).map((e) => (
                            <SelectItem key={e.eventId} value={String(e.eventId)}>{e.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={attendeeQuery} onChange={(e) => setAttendeeQuery(e.target.value)} placeholder="Search attendees…" className="pl-9" />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All attendees</SelectItem>
                          <SelectItem value="checked_in">Checked in</SelectItem>
                          <SelectItem value="pending">Not checked in</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        disabled={!selectedEventId || filteredAttendees.length === 0}
                        onClick={() => downloadCsv("attendees.csv", [
                          ["Name", "Email", "Ticket type", "Status", "Ticket code", "Checked in", "Amount"],
                          ...filteredAttendees.map((a) => [
                            a.name, a.email, a.ticketType, a.status,
                            a.checkedInAt ? new Date(a.checkedInAt).toLocaleString("en-IN") : "No",
                            a.amount ?? 0,
                          ]),
                        ])}
                      >
                        <Download className="h-3.5 w-3.5" /> Export CSV
                      </Button>
                    </div>

                    {!selectedEventId ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Pick an event to manage its attendees.</p>
                    ) : attendeesLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filteredAttendees.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">No attendees match.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-border/60">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="px-4 py-2.5 font-semibold">Attendee</th>
                              <th className="px-4 py-2.5 font-semibold">Ticket</th>
                              <th className="px-4 py-2.5 font-semibold">Attendance</th>
                              <th className="px-4 py-2.5 font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredAttendees.map((a) => (
                              <tr key={a.registrationId} className="transition-colors hover:bg-accent/30">
                                <td className="px-4 py-3">
                                  <p className="font-semibold">{a.name}</p>
                                  <p className="text-xs text-muted-foreground">{a.email}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={a.ticketType === "VIP" ? "default" : "secondary"} className="gap-1 text-xs">
                                    {a.ticketType === "VIP" && <Crown className="h-3 w-3" />} {a.ticketType}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  {a.checkedInAt ? (
                                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                      ✓ {new Date(a.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">Pending</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-medium">{a.amount != null ? inr(a.amount) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Waitlist management */}
              <TabsContent value="waitlist">
                <Card className="border-border/60 shadow-[var(--shadow-card)]">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="Select an event…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {(overview?.perEvent ?? []).map((e) => (
                              <SelectItem key={e.eventId} value={String(e.eventId)}>{e.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge variant="secondary">{waitlistRows.length} waiting</Badge>
                      </div>
                      <Button size="sm" className="gap-1.5" disabled={!selectedEventId || promoteMut.isPending} onClick={() => promoteMut.mutate()}>
                        {promoteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Promote next in line
                      </Button>
                    </div>
                    {waitlistRows.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Nobody is waiting for this event.</p>
                    ) : (
                      <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                        {waitlistRows.map((w, i) => (
                          <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">#{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{w.name}</p>
                              <p className="text-xs text-muted-foreground">{w.email}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {w.joinedAt ? new Date(w.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Top performers strip */}
            {overview?.topEvents && overview.topEvents.length > 0 && (
              <Card className="mt-6 border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-primary" /> Top performing events
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {overview.topEvents.map((e, i) => (
                      <div key={e.eventId} className="rounded-xl border border-border/60 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">#{i + 1}</p>
                        <p className="mt-1 truncate text-sm font-bold">{e.title}</p>
                        <p className="mt-1 text-lg font-extrabold gradient-text">{inr(e.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{e.registered} registered · {e.conversionRate}% filled</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── Announcement dialog ── */}
        <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" /> Send announcement
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Schedule update, gate info…" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea value={annMessage} onChange={(e) => setAnnMessage(e.target.value)} placeholder="Hi everyone — the keynote moves to 11 AM…" rows={4} maxLength={800} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={annWaitlist} onCheckedChange={(c) => setAnnWaitlist(c === true)} />
                Also notify the waitlist
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAnnounceOpen(false)}>Cancel</Button>
              <Button onClick={() => announceMut.mutate()} disabled={!annTitle.trim() || !annMessage.trim() || announceMut.isPending} className="gap-1.5">
                {announceMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send to attendees
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </Layout>
  );
}
