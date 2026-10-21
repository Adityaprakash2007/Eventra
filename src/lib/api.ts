import * as mock from "./mockData";

const BASE_URL = "/api";

// Preview-mode fallback: when there is no live backend to talk to (e.g. this
// static preview build), fall back to local mock data instead of failing.
const idToNum = (id: string) => Number(id.replace(/\D/g, "")) || 0;

const mockFallback: Record<string, () => unknown> = {
  "/events": () => mock.events.map(e => ({ ...e, id: idToNum(e.id) })),
  "/users": () => mock.users.map(u => ({ ...u, id: idToNum(u.id) })),
  "/registrations": () => mock.registrations.map(r => ({
    ...r,
    id: idToNum(r.id),
    eventId: idToNum(r.eventId),
    event: { id: idToNum(r.eventId), title: mock.events.find(e => e.id === r.eventId)?.title ?? "" },
  })),
  "/payments": () => mock.payments.map(p => ({ ...p, id: idToNum(p.id) })),
  "/stats": () => mock.stats,
  "/stats/registrations-per-event": () => mock.registrationsPerEvent,
};

function getMockFallback(endpoint: string): unknown | undefined {
  // exact match first (e.g. "/events"), then single-item lookups (e.g. "/events/3")
  if (mockFallback[endpoint]) return mockFallback[endpoint]();
  const eventMatch = endpoint.match(/^\/events\/(\w+)$/);
  if (eventMatch) {
    const found = mock.events.find(e => idToNum(e.id) === Number(eventMatch[1]));
    return found ? { ...found, id: idToNum(found.id) } : undefined;
  }
  return undefined;
}

// Simulates a write (POST/PUT/DELETE) when no backend is reachable, so the
// preview's user flows (register -> pay -> confirm) work end to end without
// a real database. Nothing here persists across a page reload.
let mockIdCounter = 1000;
function getMockWriteFallback(endpoint: string, method: string, body: unknown): unknown | undefined {
  const payload = (typeof body === "string" ? JSON.parse(body) : body) as Record<string, unknown> | undefined;

  if (method === "POST" && endpoint === "/registrations") {
    const eventId = Number(payload?.eventId);
    return {
      id: ++mockIdCounter,
      user: payload?.user,
      eventId,
      ticket: payload?.ticket,
      status: "Pending",
      event: { id: eventId, title: mock.events.find(e => idToNum(e.id) === eventId)?.title ?? "" },
    };
  }

  if (method === "POST" && endpoint === "/payments") {
    return {
      id: ++mockIdCounter,
      user: payload?.user,
      amount: payload?.amount,
      method: payload?.method ?? "Razorpay",
      status: payload?.status ?? "Paid",
    };
  }

  if (method === "POST" && endpoint === "/events") {
    return { id: ++mockIdCounter, ...payload };
  }

  if (method === "PUT" && endpoint.match(/^\/events\/\w+$/)) {
    return { id: idToNum(endpoint.split("/")[2]), ...payload };
  }

  if (method === "DELETE" && endpoint.match(/^\/events\/\w+$/)) {
    return { success: true };
  }

  return undefined;
}
const TOKEN_KEY = "ef_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** 401 handler — lets the auth context clear state and bounce to /login. */
export let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const token = getToken();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    const contentType = res.headers.get("content-type") || "";
    // A static host (e.g. Vercel SPA rewrites) can answer /api/* with HTML —
    // treat any non-OK or non-JSON response as "backend unreachable".
    if (!res.ok || !contentType.includes("application/json")) {
      if (res.status === 401 && !endpoint.startsWith("/auth/")) {
        setToken(null);
        onUnauthorized?.();
      }
      const body = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};
      throw new Error(body.error || `Request failed with status ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    // No backend reachable — fall back to mock data/writes so the preview
    // still works. Real deployments with a live API will never hit this.
    if (method === "GET") {
      const fallback = getMockFallback(endpoint);
      if (fallback !== undefined) {
        console.warn(`[api] No backend reachable for ${endpoint} — using mock data.`);
        return fallback as T;
      }
    } else {
      const fallback = getMockWriteFallback(endpoint, method, options?.body);
      if (fallback !== undefined) {
        console.warn(`[api] No backend reachable for ${method} ${endpoint} — simulating response.`);
        return fallback as T;
      }
    }
    throw err;
  }
}
export type Event = {
  id: number;
  title: string;
  venue: string;
  state?: string | null;
  city?: string | null;
  date: string;
  time?: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
  seats: number;
  capacity?: number;
  registered?: number;
  price: number;
  image?: string | null;
  category?: string;
  description?: string;
  status?: string;
  agenda?: string | null;
  agendaItems?: AgendaItemRow[];
  venueLat?: number | null;
  venueLng?: number | null;
  organizerId?: number | null;
  organizerName?: string | null;
  organizerBio?: string | null;
  organizer?: { name: string; bio: string | null };
  attendeesCount?: number;
};

export type AgendaItemRow = {
  id: number;
  title: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  speaker?: string | null;
};

export type User = {
  id: number;
  name: string;
  email: string;
  joined: string;
};

export type Registration = {
  id: number;
  user: string;
  userId?: number;
  eventId: number;
  ticket: "VIP" | "Regular";
  ticketCode?: string | null;
  status: "Confirmed" | "Pending";
  totalAmount?: number | null;
  checkedInAt?: string | null;
  registeredAt?: string | null;
  event?: { id: number; title: string; date?: string } | null;
};

export type Payment = {
  id: number;
  user: string;
  amount: number;
  method: "UPI" | "Card" | "Razorpay";
  status: "Paid" | "Pending";
};

export type Stats = {
  totalUsers: number;
  totalEvents: number;
  totalRegistrations: number;
  totalRevenue: number;
};

export type RegistrationPerEvent = {
  name: string;
  registrations: number;
};

/* ── Tickets / QR ─────────────────────────────────────────── */

export type TicketShape = {
  registrationId: number;
  ticketCode: string | null;
  ticketType: string;
  status: string;
  registeredAt?: string | null;
  checkedInAt?: string | null;
  amount?: number | null;
  event?: {
    id: number;
    title: string;
    venue?: string;
    city?: string | null;
    state?: string | null;
    category?: string;
    image?: string | null;
    startDate?: string;
    endDate?: string;
  } | null;
  user?: { id: number; name: string; email: string } | null;
};

export type MyTickets = { upcoming: TicketShape[]; past: TicketShape[]; total: number };

export const fetchMyTickets = () => request<MyTickets>("/tickets");
export const fetchTicket = (idOrCode: number | string) => request<TicketShape>(`/tickets/${idOrCode}`);
export const fetchTicketQr = (idOrCode: number | string) =>
  request<{ qr: string; ticketCode: string }>(`/tickets/${idOrCode}/qr`);
export const issueTicket = (registrationId: number) =>
  request<TicketShape>("/tickets", { method: "POST", body: JSON.stringify({ registrationId }) });
export const checkinTicket = (code: string) =>
  request<{
    success: boolean;
    valid: boolean;
    duplicate?: boolean;
    checkedInAt?: string;
    error?: string;
    attendee?: { name: string; email?: string; ticketType: string; registrationId: number };
    event?: { id: number; title: string } | null;
  }>("/tickets/checkin", { method: "POST", body: JSON.stringify({ code }) });
export const fetchAttendanceStats = (eventId: number | string) =>
  request<{
    eventId: number;
    eventTitle: string;
    totalConfirmed: number;
    checkedIn: number;
    pending: number;
    attendanceRate: number;
    vipTickets: number;
  }>(`/tickets/stats/${eventId}`);
export const fetchAttendees = (eventId: number | string, params?: { q?: string; status?: string }) => {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  return request<AttendeeRow[]>(`/tickets/attendees/${eventId}${qs ? `?${qs}` : ""}`);
};

export type AttendeeRow = {
  registrationId: number;
  ticketCode?: string | null;
  ticketType: string;
  status: string;
  registeredAt?: string | null;
  checkedInAt?: string | null;
  amount?: number | null;
  name: string;
  email: string;
};

/* ── Waitlist ─────────────────────────────────────────────── */

export type WaitlistEntry = {
  id: number;
  eventId: number;
  status: string;
  joinedAt?: string;
  promotedAt?: string | null;
  position: number | null;
  event?: { id: number; title: string; date?: string; venue?: string; city?: string | null } | null;
};

export const fetchMyWaitlist = () => request<WaitlistEntry[]>("/waitlist");
export const joinWaitlist = (eventId: number | string) =>
  request<{ id: number; position: number; message: string }>("/waitlist", {
    method: "POST",
    body: JSON.stringify({ eventId }),
  });
export const leaveWaitlist = (id: number) =>
  request<{ success: boolean }>(`/waitlist/${id}`, { method: "DELETE" });
export const fetchEventWaitlist = (eventId: number | string) =>
  request<{ id: number; name: string; email: string; joinedAt?: string }[]>(`/waitlist/event/${eventId}`);
export const promoteWaitlist = (eventId: number | string) =>
  request<{ success: boolean; promoted: number }>(`/waitlist/promote/${eventId}`, { method: "POST" });

/* ── Feedback & ratings ───────────────────────────────────── */

export type FeedbackSummary = {
  reviews: { id: number; rating: number; review?: string | null; createdAt?: string; user: string }[];
  average: number;
  count: number;
  breakdown: Record<string, number>;
};

export const fetchEventFeedback = (eventId: number | string) =>
  request<FeedbackSummary>(`/feedback/event/${eventId}`);
export const submitFeedback = (data: { eventId: number | string; rating: number; review?: string }) =>
  request<{ success: boolean; updated?: boolean }>("/feedback", { method: "POST", body: JSON.stringify(data) });
export const fetchMyFeedback = () =>
  request<{ id: number; rating: number; review?: string | null; event?: { id: number; title: string } | null }[]>("/feedback/mine");

/* ── Saved events ─────────────────────────────────────────── */

export const fetchSavedEvents = () => request<Event[]>("/saved");
export const saveEvent = (eventId: number | string) =>
  request<{ success: boolean; saved: boolean }>("/saved", { method: "POST", body: JSON.stringify({ eventId }) });
export const unsaveEvent = (eventId: number | string) =>
  request<{ success: boolean; saved: boolean }>(`/saved/${eventId}`, { method: "DELETE" });

/* ── Notifications (server-persisted) ─────────────────────── */

export type ServerNotification = {
  id: number;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  read: boolean;
  time: string;
};

export const fetchNotifications = (unreadOnly = false) =>
  request<ServerNotification[]>(`/notifications${unreadOnly ? "?unread=1" : ""}`);
export const fetchUnreadCount = () => request<{ count: number }>("/notifications/unread-count");
export const markAllNotificationsRead = () =>
  request<{ success: boolean }>("/notifications/read-all", { method: "POST" });
export const markNotificationRead = (id: number) =>
  request<{ success: boolean }>(`/notifications/${id}/read`, { method: "POST" });
export const deleteNotification = (id: number) =>
  request<{ success: boolean }>(`/notifications/${id}`, { method: "DELETE" });
export const clearNotifications = () => request<{ success: boolean }>("/notifications", { method: "DELETE" });

/* ── Predictions / recommendations / smart search ─────────── */

export type Prediction = {
  eventId: number;
  title: string;
  category?: string;
  city?: string | null;
  startDate?: string;
  capacity: number;
  registered: number;
  popularity: number;
  confidence: number;
  expectedAttendance: number;
  trendPct: number;
  trend: "up" | "down" | "flat";
  label: "High" | "Medium" | "Low";
  emoji: string;
  color: "high" | "medium" | "low";
  signals: { demand: number; fill: number; timing: number; category: number };
};

export const fetchPredictions = () =>
  request<{ generatedAt: string; predictions: Prediction[] }>("/predictions");

export type Recommendation = {
  eventId: number;
  title: string;
  category?: string;
  city?: string | null;
  venue?: string;
  date?: string;
  price: number;
  seats: number;
  score: number;
  reasons: string[];
};

export const fetchRecommendations = () =>
  request<{ recommendations: Recommendation[]; basedOn: boolean }>("/predictions/recommendations");

export type SearchResult = Event & { _sim?: number };

export const smartSearch = (params: {
  q?: string;
  category?: string;
  city?: string;
  state?: string;
  from?: string;
  to?: string;
  sort?: string;
}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) sp.set(k, String(v));
  });
  const qs = sp.toString();
  return request<{ results: SearchResult[]; count: number }>(`/predictions/search${qs ? `?${qs}` : ""}`);
};

export const fetchSearchSuggestions = (q: string) =>
  request<{ suggestions: { type: string; label: string; eventId?: number; category?: string }[] }>(
    `/predictions/search/suggestions?q=${encodeURIComponent(q)}`
  );

/* ── Organizer analytics & attendee management ────────────── */

export type OrganizerOverview = {
  summary: {
    totalEvents: number;
    totalRevenue: number;
    totalRegistrations: number;
    totalCheckedIn: number;
    avgConversion: number;
    avgAttendance: number;
  };
  perEvent: {
    eventId: number;
    title: string;
    startDate?: string;
    capacity: number;
    registered: number;
    checkedIn: number;
    revenue: number;
    conversionRate: number;
    attendanceRate: number;
    avgRating: number | null;
  }[];
  topEvents: OrganizerOverview["perEvent"];
  growth: { label: string; registrations: number; revenue: number }[];
};

export const fetchOrganizerOverview = () => request<OrganizerOverview>("/organizer/overview");

export const sendAnnouncement = (
  eventId: number | string,
  data: { title: string; message: string; includeWaitlist?: boolean }
) =>
  request<{ success: boolean; reached: number }>(`/organizer/events/${eventId}/announce`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createOrganizerEvent = (data: Record<string, unknown>) =>
  request<{ success: boolean; eventId: number }>("/organizer/events", {
    method: "POST",
    body: JSON.stringify(data),
  });

/* ── Profile ──────────────────────────────────────────────── */

export type Profile = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  bio?: string | null;
  avatarColor?: string;
  interests: string[];
  state?: string | null;
  city?: string | null;
  joined?: string;
};

export type ProfileActivity = {
  profile: Profile;
  activity: {
    totalRegistrations: number;
    upcoming: number;
    attended: number;
    savedEvents: number;
    reviewsWritten: number;
  };
  registrations: {
    id: number;
    status: string;
    ticketType: string;
    ticketCode?: string | null;
    totalAmount?: number | null;
    registeredAt?: string | null;
    checkedInAt?: string | null;
    event?: {
      id: number;
      title: string;
      date?: string;
      venue?: string;
      city?: string | null;
      category?: string;
      upcoming: boolean;
    } | null;
  }[];
};

export const fetchProfile = () => request<ProfileActivity>("/profile");
export const updateProfile = (data: Partial<Profile> & { interests?: string[] }) =>
  request<{ success: boolean; profile: Profile }>("/profile", { method: "PUT", body: JSON.stringify(data) });
export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  request<{ success: boolean }>("/profile/password", { method: "PUT", body: JSON.stringify(data) });

/* ── Existing endpoints ───────────────────────────────────── */

export const fetchEvents = (location?: { state?: string; city?: string; category?: string }) => {
  const params = new URLSearchParams();
  if (location?.state) params.set("state", location.state);
  if (location?.city) params.set("city", location.city);
  if (location?.category && location.category !== "All") params.set("category", location.category);
  const qs = params.toString();
  return request<Event[]>(`/events${qs ? `?${qs}` : ""}`);
};
export const fetchEvent = (id: number | string) => request<Event>(`/events/${id}`);
export const createEvent = (data: Omit<Event, "id">) =>
  request<Event>("/events", { method: "POST", body: JSON.stringify(data) });
export const updateEvent = (id: number | string, data: Partial<Omit<Event, "id">>) =>
  request<Event>(`/events/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteEvent = (id: number | string) =>
  request<{ success: boolean }>(`/events/${id}`, { method: "DELETE" });

export const fetchUsers = () => request<User[]>("/users");


export const fetchRegistrations = () => request<Registration[]>("/registrations");
export const createRegistration = (data: { user: string; eventId: number | string; ticket: string }) =>
  request<Registration>("/registrations", { method: "POST", body: JSON.stringify(data) });
export const cancelRegistration = (id: number) =>
  request<{ success: boolean }>(`/registrations/${id}`, { method: "DELETE" });


export const fetchPayments = () => request<Payment[]>("/payments");
export const createPayment = (data: { user: string; amount: number; method: string; status?: string; registrationId?: number }) =>
  request<Payment>("/payments", { method: "POST", body: JSON.stringify(data) });


export const fetchStats = () => request<Stats>("/stats");
export const fetchRegistrationsPerEvent = () => request<RegistrationPerEvent[]>("/stats/registrations-per-event");
