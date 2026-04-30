// ── Centralized API client for EventFlow Hub ──────────────────
// All fetch calls go through here so we have a single place to
// change the base URL, add auth headers, etc.

const BASE_URL = "/api";

// ── Helper ──────────────────────────────────────────────────
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Types (re-exported from mockData for compatibility) ─────
export type Event = {
  id: number;
  title: string;
  venue: string;
  date: string;
  seats: number;
  price: number;
  image?: string;
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
  eventId: number;
  ticket: "VIP" | "Regular";
  status: "Confirmed" | "Pending";
  event?: { id: number; title: string };
};

export type Payment = {
  id: number;
  user: string;
  amount: number;
  method: "UPI" | "Card";
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

// ── Events ──────────────────────────────────────────────────
export const fetchEvents = () => request<Event[]>("/events");
export const fetchEvent = (id: number | string) => request<Event>(`/events/${id}`);
export const createEvent = (data: Omit<Event, "id">) =>
  request<Event>("/events", { method: "POST", body: JSON.stringify(data) });
export const updateEvent = (id: number | string, data: Partial<Omit<Event, "id">>) =>
  request<Event>(`/events/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteEvent = (id: number | string) =>
  request<{ success: boolean }>(`/events/${id}`, { method: "DELETE" });

// ── Users ───────────────────────────────────────────────────
export const fetchUsers = () => request<User[]>("/users");

// ── Registrations ───────────────────────────────────────────
export const fetchRegistrations = () => request<Registration[]>("/registrations");
export const createRegistration = (data: { user: string; eventId: number | string; ticket: string }) =>
  request<Registration>("/registrations", { method: "POST", body: JSON.stringify(data) });

// ── Payments ────────────────────────────────────────────────
export const fetchPayments = () => request<Payment[]>("/payments");
export const createPayment = (data: { user: string; amount: number; method: string; status?: string }) =>
  request<Payment>("/payments", { method: "POST", body: JSON.stringify(data) });

// ── Stats ───────────────────────────────────────────────────
export const fetchStats = () => request<Stats>("/stats");
export const fetchRegistrationsPerEvent = () => request<RegistrationPerEvent[]>("/stats/registrations-per-event");
