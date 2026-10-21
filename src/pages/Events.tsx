import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { EventCardSkeleton } from "@/components/Skeletons";
import EmptyState from "@/components/EmptyState";
import LocationGate from "@/components/LocationGate";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { fetchEvents, fetchSearchSuggestions, type Event } from "@/lib/api";
import { fuzzyScore } from "@/lib/search";
import {
  loadSavedLocation,
  saveLocation,
  clearSavedLocation,
  type SavedLocation,
} from "@/lib/location";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users, Search, X, MapPinned, ArrowUpDown, Clock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const DATE_FILTERS = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
] as const;
type DateFilter = (typeof DATE_FILTERS)[number]["value"];

// Map event category / title keywords → image
const categoryImages: Record<string, string> = {
  Technical: "/events/technical.png",
  Entertainment: "/events/entertainment.png",
  Cultural: "/events/cultural.png",
  General: "/events/general.png",
};

function getEventImage(event: Event): string {
  // Prefer an image supplied by the API
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

const PAGE_SIZE = 6;

export default function Events() {
  usePageTitle("Events");
  const navigate = useNavigate();

  // ── Location-first flow ────────────────────────────────────────────
  // A saved location (localStorage) means returning users see events
  // immediately; otherwise the location popup blocks this page.
  const [location, setLocation] = useState<SavedLocation | null>(() => loadSavedLocation());
  const [gateOpen, setGateOpen] = useState(() => !loadSavedLocation());

  const applyLocation = (loc: SavedLocation) => {
    setLocation(loc);
    setGateOpen(false);
  };

  const changeLocation = () => {
    clearSavedLocation();
    setLocation(null);
    setGateOpen(true);
  };

  // Events for the chosen state+city (server filters case-insensitively)
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", location?.state, location?.city],
    queryFn: () => fetchEvents({ state: location?.state, city: location?.city }),
    enabled: !!location,
  });

  // Sibling cities in the same state (for the "no events here yet" hint)
  const { data: stateLocations = [] } = useQuery({
    queryKey: ["eventLocations"],
    queryFn: async () => {
      const res = await fetch("/api/events/locations");
      if (!res.ok) return [];
      return (await res.json()) as { state: string; cities: string[] }[];
    },
    enabled: !!location,
  });

  const otherCities = useMemo(() => {
    if (!location) return [];
    const st = stateLocations.find((s) => s.state.toLowerCase() === location.state.toLowerCase());
    return (st?.cities ?? []).filter((c) => c.toLowerCase() !== location.city.toLowerCase());
  }, [stateLocations, location]);

  const switchToCity = (city: string) => {
    if (!location) return;
    const next = { state: location.state, city };
    saveLocation(next);
    applyLocation(next);
  };

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [suggestions, setSuggestions] = useState<{ type: string; label: string; eventId?: number; category?: string }[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  // Debounced smart-search suggestions from the server
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetchSearchSuggestions(q);
        setSuggestions(res.suggestions.slice(0, 6));
        setShowSuggest(true);
      } catch {
        setSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(events.map((e) => e.category).filter(Boolean))) as string[]],
    [events]
  );

  const matchesDate = (e: Event) => {
    if (dateFilter === "any") return true;
    const d = new Date(e.date);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = (base: Date) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    switch (dateFilter) {
      case "today": return d >= startOfToday && d < dayEnd(startOfToday);
      case "week": return d >= startOfToday && d < dayEnd(new Date(startOfToday.getTime() + 6 * 864e5));
      case "month": return d >= startOfToday && d < dayEnd(new Date(startOfToday.getTime() + 29 * 864e5));
      case "custom": {
        if (from && d < new Date(`${from}T00:00:00`)) return false;
        if (to && d > new Date(`${to}T23:59:59`)) return false;
        return true;
      }
      default: return true;
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = events.filter((e) => {
      const matchesQuery =
        !q ||
        fuzzyScore(e.title, q) > 0 ||
        fuzzyScore(e.venue, q) > 0 ||
        fuzzyScore(e.category ?? "", q) > 0 ||
        fuzzyScore(e.city ?? "", q) > 0;
      const matchesCategory = category === "All" || e.category === category;
      return matchesQuery && matchesCategory && matchesDate(e);
    });
    // Relevance sort while searching, date sort otherwise.
    return [...list].sort((a, b) => {
      if (q) {
        const diff = fuzzyScore(b.title, q) - fuzzyScore(a.title, q);
        if (Math.abs(diff) > 0.01) return diff;
      }
      const cmp = a.date.localeCompare(b.date) || a.id - b.id;
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, query, category, sortDir, dateFilter, from, to]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  // Seat fill % — total taken is unknown client-side, so show availability ratio vs capacity
  const seatPct = (e: Event) => {
    // seats here are remaining capacity from the API; clamp for display
    const pct = Math.max(4, Math.min(100, e.seats > 0 ? Math.min(e.seats, 100) : 0));
    return pct;
  };

  return (
    <Layout>
      <PageTransition>
        {/* Location gate popup — blocks until a location is picked */}
        <LocationGate open={gateOpen} onApply={applyLocation} />

        {/* Events header — shows the chosen location with Change Location */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Events in{" "}
              {location ? (
                <span className="gradient-text">{location.city}, {location.state}</span>
              ) : (
                <span className="gradient-text">your area</span>
              )}
            </h1>
            <p className="mt-1 text-muted-foreground">Discover and register for events happening near you.</p>
          </div>
          <Button variant="outline" size="sm" onClick={changeLocation} className="gap-2">
            <MapPinned className="h-4 w-4" />
            Change Location
          </Button>
        </div>

        {location && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <MapPin className="h-3 w-3" />
              {location.city}, {location.state}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {filtered.length} {filtered.length === 1 ? "event" : "events"} in {location.city}, {location.state}
            </Badge>
          </div>
        )}

        {/* Search + category filter pills */}
        {location && (
          <div className="mb-6 space-y-3">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                onFocus={() => query.trim().length >= 2 && setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="Search events, venues, cities…"
                className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {/* Smart search suggestions */}
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-xl border border-border/70 bg-card shadow-elegant">
                  <p className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" /> Suggestions
                  </p>
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.type}-${s.label}-${i}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (s.eventId) navigate(`/events/${s.eventId}`);
                        else if (s.type === "category" && s.category) setCategory(s.category);
                        else setQuery(s.label);
                        setShowSuggest(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{s.type}</span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date sort + date-range filters */}
            <div className="flex flex-wrap items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
                  setVisible(PAGE_SIZE);
                }}
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
                aria-label="Sort events by date"
              >
                <option value="asc">Date: soonest first</option>
                <option value="desc">Date: latest first</option>
              </select>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as DateFilter);
                  setVisible(PAGE_SIZE);
                }}
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
                aria-label="Filter events by date"
              >
                {DATE_FILTERS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              {dateFilter === "custom" && (
                <>
                  <input
                    type="date" value={from}
                    onChange={(e) => { setFrom(e.target.value); setVisible(PAGE_SIZE); }}
                    className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                    aria-label="From date"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="date" value={to}
                    onChange={(e) => { setTo(e.target.value); setVisible(PAGE_SIZE); }}
                    className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                    aria-label="To date"
                  />
                </>
              )}
            </div>

            <div className="scrollbar-thin flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCategory(c);
                    setVisible(PAGE_SIZE);
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                    category === c
                      ? "border-transparent bg-gradient-primary text-primary-foreground shadow-glow-sm"
                      : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {!location ? null : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title={
              events.length > 0
                ? "No events match your search"
                : `No events found in ${location.city} yet`
            }
            description={
              events.length > 0
                ? "Try a different keyword or clear the category filter to see more events."
                : otherCities.length
                  ? `Try one of the other cities in ${location.state}: ${otherCities.slice(0, 4).join(", ")}${otherCities.length > 4 ? "…" : ""}`
                  : "Check back soon — new events are added regularly."
            }
            actionLabel={
              events.length > 0 ? "Clear filters" : otherCities.length ? "Change location" : "Clear filters"
            }
            onAction={
              events.length > 0
                ? () => { setQuery(""); setCategory("All"); }
                : otherCities.length
                  ? changeLocation
                  : () => { setQuery(""); setCategory("All"); }
            }
          />
        ) : (
          <>
            {/* Sibling-city quick switcher when the current city has events */}
            {otherCities.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Also in {location.state}:</span>
                {otherCities.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    onClick={() => switchToCity(c)}
                    className="rounded-full border border-border/70 bg-card px-3 py-1 font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => {
                const pct = seatPct(e);
                const sellingFast = pct >= 80;
                return (
                  <Card
                    key={e.id}
                    className="group relative overflow-hidden border-border/60 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-elegant"
                  >
                    <div className="relative h-52 overflow-hidden">
                      <img
                        src={getEventImage(e)}
                        alt={e.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                      <Badge className="absolute right-3 top-3 bg-card text-foreground shadow-md hover:bg-card">
                        ₹{e.price === 0 ? "Free" : e.price}
                      </Badge>
                      {e.category && (
                        <Badge variant="secondary" className="absolute left-3 top-3 border-0 bg-black/50 text-[10px] text-white backdrop-blur-sm">
                          {e.category}
                        </Badge>
                      )}
                      {sellingFast && (
                        <Badge className="absolute bottom-3 left-3 border-0 bg-amber-500 text-[10px] text-white shadow-md">
                          🔥 Selling fast
                        </Badge>
                      )}
                      <h3 className="absolute bottom-3 right-3 left-3 truncate text-lg font-bold text-white drop-shadow">
                        {e.title}
                      </h3>
                    </div>

                    <CardContent className="p-5">
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
                          <span className="truncate">{e.venue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0 text-primary/70" />
                          {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {e.time && (
                            <span className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />{e.time}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Seat availability progress */}
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {e.seats} seats available
                          </span>
                          <span className={cn("font-semibold", sellingFast ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                            {pct >= 80 ? "Filling up" : "Available"}
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>

                      <div className="mt-5 flex gap-2">
                        <Button
                          className="flex-1 transition-all hover:shadow-glow-sm"
                          onClick={() => navigate(`/register?event=${e.id}`)}
                        >
                          Register
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={() => navigate(`/events/${e.id}`)}>
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <Button variant="outline" size="lg" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load more events ({filtered.length - visible} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </PageTransition>
    </Layout>
  );
}
