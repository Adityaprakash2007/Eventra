import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import VenueMap from "@/components/VenueMap";
import EmptyState from "@/components/EmptyState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { fetchEvent, fetchEventFeedback, submitFeedback, saveEvent, unsaveEvent, joinWaitlist, type Event as EventType } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, MapPin, Users, Share2, Bookmark, BookmarkCheck, Ticket, Clock,
  ArrowLeft, ChevronRight, Star, Loader2, UserRound, Hourglass, Check,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Map event category / title keywords → image (mirrors Events.tsx)
const categoryImages: Record<string, string> = {
  Technical: "/events/technical.png",
  Entertainment: "/events/entertainment.png",
  Cultural: "/events/cultural.png",
  General: "/events/general.png",
};

function getEventImage(event: EventType): string {
  if (event.image) return event.image;
  const t = event.title.toLowerCase();
  if (t.includes("hack")) return "/events/hackathon.png";
  if (t.includes("drama") || t.includes("theater") || t.includes("theatre") || t.includes("play")) return "/events/drama.png";
  if (t.includes("dance")) return "/events/cultural.png";
  if (t.includes("music") || t.includes("concert")) return "/events/entertainment.png";
  if (t.includes("tech") || t.includes("code") || t.includes("ai") || t.includes("symposium")) return "/events/technical.png";
  if (event.category && categoryImages[event.category]) return categoryImages[event.category];
  return "/events/general.png";
}

function StarButton({ value, hover, setHover, rating, setRating }: {
  value: number; hover: number | null; setHover: (v: number | null) => void; rating: number; setRating: (v: number) => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(value)}
      onMouseLeave={() => setHover(null)}
      onClick={() => setRating(value)}
      aria-label={`${value} star${value > 1 ? "s" : ""}`}
      className="transition-transform hover:scale-110"
    >
      <Star className={cn("h-6 w-6", (hover ?? rating) >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
    </button>
  );
}

export default function EventDetails() {
  const { id } = useParams();
  usePageTitle("Event details");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoggedIn } = useAuth();

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEvent(id!),
  });

  const { data: feedback } = useQuery({
    queryKey: ["feedback", id],
    queryFn: () => fetchEventFeedback(id!),
  });

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fbMut = useMutation({
    mutationFn: () => submitFeedback({ eventId: id!, rating, review: review || undefined }),
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setRating(0);
      setReview("");
      void qc.invalidateQueries({ queryKey: ["feedback", id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not submit feedback"),
  });

  const saveMut = useMutation({
    mutationFn: () => saveEvent(id!),
    onSuccess: () => {
      toast.success("Event saved — find it under your profile.");
      void qc.invalidateQueries({ queryKey: ["savedEvents"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save event"),
  });

  const waitlistMut = useMutation({
    mutationFn: () => joinWaitlist(id!),
    onSuccess: (data) => toast.success(data.message || "You're on the waitlist!"),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not join waitlist"),
  });

  const [shareOpen, setShareOpen] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.title, text: `Check out ${event?.title}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Event link copied to clipboard");
    } catch {
      setShareOpen((v) => !v);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (isError || !event) {
    return (
      <Layout>
        <PageTransition>
          <EmptyState
            icon="search"
            title="Event not found"
            description="This event may have been removed or the link is incorrect."
            actionLabel="Browse events"
            onAction={() => navigate("/events")}
          />
        </PageTransition>
      </Layout>
    );
  }

  const isPast = event.endDateTime
    ? new Date(event.endDateTime) < new Date()
    : new Date(event.date) < new Date();
  const soldOut = event.seats <= 0;
  const capacity = event.capacity ?? event.registered + event.seats;
  const fillPct = capacity > 0 ? Math.min(100, Math.round((event.registered ?? 0) / capacity * 100)) : 0;
  const agenda = (event.agendaItems && event.agendaItems.length > 0)
    ? event.agendaItems
    : (event.agenda ? event.agenda.split("\n").filter(Boolean).map((line, i) => ({ id: i, title: line })) : []);

  return (
    <Layout>
      <PageTransition>
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* ── Banner ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-elegant">
          <img src={getEventImage(event)} alt={event.title} className="h-64 w-full object-cover sm:h-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {event.category && (
                <Badge className="border-0 bg-white/20 text-[11px] text-white backdrop-blur-sm">{event.category}</Badge>
              )}
              {isPast ? (
                <Badge className="border-0 bg-muted text-[11px] text-foreground">Ended</Badge>
              ) : soldOut ? (
                <Badge className="border-0 bg-amber-500 text-[11px] text-white">Sold out</Badge>
              ) : fillPct >= 80 ? (
                <Badge className="border-0 bg-amber-500 text-[11px] text-white">🔥 Filling fast</Badge>
              ) : null}
            </div>
            <h1 className="max-w-3xl text-2xl font-extrabold tracking-tight text-white drop-shadow sm:text-4xl">
              {event.title}
            </h1>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ── Main column ──────────────────────────────────── */}
          <div className="space-y-6">
            {/* Quick facts */}
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(event.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">{event.time || "Time TBA"}{event.endDateTime && event.startDateTime ? ` · ends ${new Date(event.endDateTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{event.venue}</p>
                    <p className="text-xs text-muted-foreground">{[event.city, event.state].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{event.attendeesCount ?? event.registered ?? 0} registered</p>
                    <p className="text-xs text-muted-foreground">{soldOut ? "No seats left" : `${event.seats} seats available`}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">₹{event.price === 0 ? "Free" : event.price.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">per person · Regular</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-3 text-lg font-bold">About this event</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {event.description || "Join us for an unforgettable experience. Network with industry leaders, enjoy curated content, and take home memorable moments."}
                </p>
              </CardContent>
            </Card>

            {/* Agenda */}
            {agenda.length > 0 && (
              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardContent className="p-5 sm:p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                    <Clock className="h-4 w-4 text-primary" /> Agenda &amp; Schedule
                  </h2>
                  <ol className="relative space-y-5 border-l border-border/70 pl-6">
                    {agenda.map((a, i) => (
                      <li key={a.id ?? i} className="relative">
                        <span className="absolute -left-[31px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-background" />
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {a.startTime && <span className="text-xs font-bold text-primary">{a.startTime}{a.endTime ? ` – ${a.endTime}` : ""}</span>}
                          <p className="text-sm font-semibold">{a.title}</p>
                        </div>
                        {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
                        {a.speaker && <p className="mt-0.5 text-xs font-medium text-foreground/70">🎙 {a.speaker}</p>}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Venue map */}
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                  <MapPin className="h-4 w-4 text-primary" /> Venue location
                </h2>
                <VenueMap
                  lat={event.venueLat}
                  lng={event.venueLng}
                  query={[event.venue, event.city !== event.venue ? event.city : null, event.state].filter(Boolean).join(", ")}
                  title={event.title}
                  height={300}
                />
              </CardContent>
            </Card>

            {/* Feedback & ratings */}
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-5 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                  <Star className="h-4 w-4 text-amber-400" /> Ratings &amp; reviews
                </h2>

                <div className="mb-6 flex flex-wrap items-center gap-6">
                  <div className="text-center">
                    <p className="text-4xl font-extrabold gradient-text">{feedback?.average?.toFixed(1) ?? "—"}</p>
                    <div className="mt-1 flex justify-center">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Star key={v} className={cn("h-4 w-4", v <= Math.round(feedback?.average ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{feedback?.count ?? 0} reviews</p>
                  </div>
                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = feedback?.breakdown?.[String(star)] ?? 0;
                      const pct = feedback?.count ? Math.round((count / feedback.count) * 100) : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-6 text-muted-foreground">{star}★</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-7 text-right text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Review form — only for past events + registered users */}
                {isLoggedIn && isPast && (
                  <div className="mb-6 rounded-xl border border-border/60 bg-accent/30 p-4">
                    <p className="mb-3 text-sm font-semibold">How was this event?</p>
                    <div className="mb-3 flex gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <StarButton key={v} value={v} hover={hover} setHover={setHover} rating={rating} setRating={setRating} />
                      ))}
                    </div>
                    <Textarea
                      placeholder="Share your experience (optional)…"
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      rows={3}
                      maxLength={1500}
                    />
                    <Button
                      className="mt-3"
                      size="sm"
                      disabled={rating === 0 || fbMut.isPending}
                      onClick={() => fbMut.mutate()}
                    >
                      {fbMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                      Submit review
                    </Button>
                  </div>
                )}

                {feedback && feedback.reviews.length > 0 ? (
                  <div className="space-y-4">
                    {feedback.reviews.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                            {r.user.split(" ").map((p) => p[0]?.toUpperCase()).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{r.user}</p>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <Star key={v} className={cn("h-3 w-3", v <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                              ))}
                            </div>
                          </div>
                          {r.review && <p className="mt-0.5 text-sm text-muted-foreground">{r.review}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No reviews yet{isPast ? " — be the first to review!" : ". Reviews open after the event ends."}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <div className="space-y-5">
            <Card className="sticky top-24 border-border/60 shadow-elegant">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
                    <p className="text-2xl font-extrabold gradient-text">
                      ₹{event.price === 0 ? "Free" : event.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={soldOut ? "destructive" : "secondary"} className="text-xs">
                    {soldOut ? "Sold out" : isPast ? "Ended" : "Open"}
                  </Badge>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{event.registered ?? 0} of {capacity || "?"} seats taken</span>
                    <span className="font-semibold">{fillPct}%</span>
                  </div>
                  <Progress value={fillPct} className="h-2" />
                </div>

                {!isLoggedIn ? (
                  <Button className="w-full" size="lg" onClick={() => navigate(`/login?next=/events/${event.id}`)}>
                    Sign in to register
                  </Button>
                ) : isPast ? (
                  <Button className="w-full" size="lg" disabled>Event ended</Button>
                ) : soldOut ? (
                  <Button className="w-full gap-2" size="lg" variant="outline" onClick={() => waitlistMut.mutate()} disabled={waitlistMut.isPending}>
                    {waitlistMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hourglass className="h-4 w-4" />}
                    Join Waitlist
                  </Button>
                ) : (
                  <Button className="w-full transition-all hover:shadow-glow-sm" size="lg" onClick={() => navigate(`/register?event=${event.id}`)}>
                    Register Now <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={share} className="gap-1.5">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-1.5">
                    {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>

                <Separator />

                {/* Organizer profile */}
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Organized by</p>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
                        {(event.organizer?.name || event.organizerName || "EV").split(" ").map((p) => p[0]?.toUpperCase()).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="flex items-center gap-1 text-sm font-semibold">
                        <UserRound className="h-3.5 w-3.5 text-primary" />
                        {event.organizer?.name || event.organizerName || "Eventra Team"}
                      </p>
                      {(event.organizer?.bio || event.organizerBio) && (
                        <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{event.organizer?.bio || event.organizerBio}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
