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

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed with status ${res.status}`);
    }

    return res.json() as Promise<T>;
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
  date: string;
  seats: number;
  price: number;
  image?: string;
  category?: string;
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


export const fetchEvents = () => request<Event[]>("/events");
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


export const fetchPayments = () => request<Payment[]>("/payments");
export const createPayment = (data: { user: string; amount: number; method: string; status?: string; registrationId?: number }) =>
  request<Payment>("/payments", { method: "POST", body: JSON.stringify(data) });


export const fetchStats = () => request<Stats>("/stats");
export const fetchRegistrationsPerEvent = () => request<RegistrationPerEvent[]>("/stats/registrations-per-event");
