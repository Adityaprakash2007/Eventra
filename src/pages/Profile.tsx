import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchProfile, fetchMyTickets, fetchEvents, fetchSavedEvents, unsaveEvent,
  updateProfile, type ProfileActivity, type Event,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User as UserIcon, Ticket, Bookmark, History, Heart, MapPin, Loader2, Check,
  CalendarDays, IndianRupee, BadgeCheck, Clock,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const INTERESTS = [
  "Music", "Tech", "Business", "Sports", "Food & Drink", "Art", "Health",
  "Education", "Networking", "Comedy", "Theatre", "Other",
] as const;

function MiniEventCard({ id, title, category, date, city, saved, onUnsave }: {
  id: number; title: string; category?: string | null; date?: string | null;
  city?: string | null; saved?: boolean; onUnsave?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/events/${id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/events/${id}`)}
      className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
        <span className="text-sm font-extrabold leading-none">
          {date ? new Date(date).getDate() : "–"}
        </span>
        <span className="text-[10px] font-semibold uppercase">
          {date ? new Date(date).toLocaleDateString("en-IN", { month: "short" }) : ""}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold group-hover:text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[category, city].filter(Boolean).join(" · ") || "Event"}
        </p>
      </div>
      {saved && onUnsave && (
        <Button
          size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500"
          onClick={(e) => { e.stopPropagation(); onUnsave(); }}
          title="Remove from saved"
        >
          <Heart className="h-4 w-4 fill-current" />
        </Button>
      )}
    </div>
  );
}

const statusBadge = (status: string) => {
  switch (status) {
    case "Confirmed": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "Pending": return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "Cancelled": return "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "Promoted": return "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400";
    default: return "";
  }
};

export default function Profile() {
  usePageTitle("Profile");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoggedIn, refreshUser } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    enabled: isLoggedIn,
  });

  const { data: ticketsData } = useQuery({
    queryKey: ["myTickets"],
    queryFn: fetchMyTickets,
    enabled: isLoggedIn,
  });

  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });

  const { data: saved = [] } = useQuery({
    queryKey: ["savedEvents"],
    queryFn: fetchSavedEvents,
    enabled: isLoggedIn,
  });

  // ── Profile edit state ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [editing, setEditing] = useState(false);
  const [interests, setInterests] = useState<string[] | null>(null);

  const activeInterests: string[] = interests ?? profile?.profile?.interests ?? [];

  const startEdit = () => {
    setName(profile?.profile?.name ?? "");
    setPhone(profile?.profile?.phone ?? "");
    setCity(profile?.profile?.city ?? "");
    setEditing(true);
  };

  const saveMut = useMutation({
    mutationFn: () => updateProfile({ name: name.trim(), phone: phone.trim(), city: city.trim() }),
    onSuccess: async () => {
      toast.success("Profile updated");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshUser?.();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const interestsMut = useMutation({
    mutationFn: (list: string[]) => updateProfile({ interests: list }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshUser?.();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save interests"),
  });

  const unsaveMut = useMutation({
    mutationFn: (eventId: number) => unsaveEvent(eventId),
    onSuccess: async () => {
      toast.success("Removed from saved events");
      await queryClient.invalidateQueries({ queryKey: ["savedEvents"] });
    },
  });

  if (!isLoggedIn) {
    return (
      <Layout>
        <PageTransition>
          <EmptyState
            icon="search"
            title="Sign in to view your profile"
            description="Your events, saved items, tickets and activity live here."
            actionLabel="Sign in"
            onAction={() => navigate("/login?next=/profile")}
          />
        </PageTransition>
      </Layout>
    );
  }

  const u = profile?.profile;
  const activity = profile?.activity;
  const registrations = profile?.registrations ?? [];
  const allTickets = [...(ticketsData?.upcoming ?? []), ...(ticketsData?.past ?? [])];

  const toggleInterest = (c: string) => {
    const next = activeInterests.includes(c)
      ? activeInterests.filter((i) => i !== c)
      : [...activeInterests, c];
    setInterests(next);
    interestsMut.mutate(next);
  };

  const eventById = (id: number) => events.find((e) => e.id === id);

  const registeredEvents: Event[] = allTickets
    .map((t) => eventById(Number(t.event?.id ?? 0)))
    .filter((e): e is Event => Boolean(e));

  const savedEvents: Event[] = saved.filter((e): e is Event => Boolean(e));

  return (
    <Layout>
      <PageTransition>
        {/* ── Header card ── */}
        <Card className="mb-6 border-border/60 shadow-[var(--shadow-card)]">
          <CardContent className="flex flex-wrap items-center gap-5 p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-3xl font-extrabold text-primary">
              {(u?.name ?? user?.name ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight">{u?.name ?? user?.name ?? "—"}</h1>
              <p className="text-sm text-muted-foreground">{u?.email ?? user?.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {u?.role === "admin" && <Badge className="gap-1"><UserIcon className="h-3 w-3" /> Admin</Badge>}
                <Badge variant="secondary" className="gap-1"><Ticket className="h-3 w-3" /> {activity?.totalRegistrations ?? 0} registrations</Badge>
                <Badge variant="secondary" className="gap-1"><Bookmark className="h-3 w-3" /> {activity?.savedEvents ?? 0} saved</Badge>
                <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" /> {activity?.attended ?? 0} attended</Badge>
              </div>
            </div>
            {!editing && <Button variant="outline" onClick={startEdit}>Edit profile</Button>}
          </CardContent>
        </Card>

        <Tabs defaultValue="about">
          <TabsList>
            <TabsTrigger value="about" className="gap-2"><UserIcon className="h-4 w-4" /> About</TabsTrigger>
            <TabsTrigger value="events" className="gap-2"><Ticket className="h-4 w-4" /> Registered</TabsTrigger>
            <TabsTrigger value="saved" className="gap-2"><Bookmark className="h-4 w-4" /> Saved</TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2"><Ticket className="h-4 w-4" /> Tickets</TabsTrigger>
            <TabsTrigger value="activity" className="gap-2"><History className="h-4 w-4" /> Activity</TabsTrigger>
          </TabsList>

          {/* ── About ── */}
          <TabsContent value="about">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Personal information</h2>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Full name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()} className="gap-1.5">
                          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                        </Button>
                        <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Name</dt><dd className="font-semibold">{u?.name ?? "—"}</dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Email</dt><dd className="font-semibold">{u?.email ?? "—"}</dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <dt className="text-muted-foreground">Phone</dt><dd className="font-semibold">{u?.phone || "—"}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">City</dt>
                        <dd className="flex items-center gap-1 font-semibold">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {u?.city || "—"}
                        </dd>
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Interests</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Power the "Recommended For You" feed.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map((c) => {
                      const active = activeInterests.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleInterest(c)}
                          disabled={interestsMut.isPending}
                          className={cn(
                            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-60",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {active && "✓ "}{c}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Registered events ── */}
          <TabsContent value="events">
            {registeredEvents.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No registrations yet"
                description="Events you register for will show up here."
                actionLabel="Browse events"
                onAction={() => navigate("/events")}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {registeredEvents.map((e) => (
                  <MiniEventCard
                    key={e.id} id={e.id} title={e.title}
                    category={e.category} date={e.date} city={e.city}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Saved events ── */}
          <TabsContent value="saved">
            {savedEvents.length === 0 ? (
              <EmptyState
                icon="search"
                title="Nothing saved yet"
                description="Tap the bookmark on any event to keep it here for later."
                actionLabel="Find events"
                onAction={() => navigate("/events")}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {savedEvents.map((e) => (
                  <MiniEventCard
                    key={e.id} id={e.id} title={e.title}
                    category={e.category} date={e.date} city={e.city}
                    saved onUnsave={() => unsaveMut.mutate(e.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tickets ── */}
          <TabsContent value="tickets">
            {allTickets.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No tickets yet"
                description="Your QR tickets will appear here after registration."
                actionLabel="Explore events"
                onAction={() => navigate("/events")}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allTickets.map((t) => (
                  <Card key={t.registrationId} className="border-border/60 shadow-[var(--shadow-card)]">
                    <CardContent className="p-4">
                      <p className="truncate text-sm font-bold">{t.event?.title ?? `Event #${t.event?.id ?? "?"}`}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {t.event?.startDate ? new Date(t.event.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="secondary">{t.ticketType ?? "General"}</Badge>
                        <Button size="sm" variant="outline" onClick={() => navigate("/tickets")}>View QR</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Activity history ── */}
          <TabsContent value="activity">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Registrations", value: activity?.totalRegistrations ?? 0, icon: Ticket },
                { label: "Upcoming", value: activity?.upcoming ?? 0, icon: Clock },
                { label: "Attended", value: activity?.attended ?? 0, icon: BadgeCheck },
                { label: "Reviews", value: activity?.reviewsWritten ?? 0, icon: History },
              ].map((s) => (
                <Card key={s.label} className="border-border/60 shadow-[var(--shadow-card)]">
                  <CardContent className="p-4 text-center">
                    <s.icon className="mx-auto h-4 w-4 text-primary" />
                    <p className="mt-1.5 text-xl font-extrabold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {registrations.length === 0 ? (
              <EmptyState icon="calendar" title="No activity yet" description="Your registration and payment history will appear here." />
            ) : (
              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/60">
                    {registrations.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {r.totalAmount ? <IndianRupee className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {r.event?.title ?? "Event"}
                            {r.event?.upcoming === false && <span className="ml-2 text-xs font-normal text-muted-foreground">(past)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.registeredAt ? new Date(r.registeredAt).toLocaleString("en-IN") : ""} · {r.ticketType}
                            {r.totalAmount ? ` · ₹${r.totalAmount}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {r.checkedInAt && (
                            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              Checked in
                            </Badge>
                          )}
                          <Badge variant="outline" className={statusBadge(r.status)}>{r.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </PageTransition>
    </Layout>
  );
}
