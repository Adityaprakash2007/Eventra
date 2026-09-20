export type Event = {
  id: string;
  title: string;
  venue: string;
  date: string;
  seats: number;
  price: number;
  image?: string;
};

export type Registration = {
  id: string;
  user: string;
  eventId: string;
  ticket: "VIP" | "Regular";
  status: "Confirmed" | "Pending";
};

export type Payment = {
  id: string;
  user: string;
  amount: number;
  method: "UPI" | "Card";
  status: "Paid" | "Pending";
};

export type User = { id: string; name: string; email: string; joined: string };

export const events: Event[] = [
  { id: "e1", title: "TechSummit 2026", venue: "Bangalore Convention Center", date: "2026-11-12", seats: 240, price: 1499 },
  { id: "e2", title: "Indie Music Fest", venue: "Mumbai Arena", date: "2026-11-20", seats: 1200, price: 899 },
  { id: "e3", title: "Designers Meetup", venue: "WeWork, Pune", date: "2026-11-28", seats: 80, price: 499 },
  { id: "e4", title: "Startup Pitch Night", venue: "T-Hub, Hyderabad", date: "2026-12-05", seats: 150, price: 0 },
  { id: "e5", title: "AI World Conference", venue: "Delhi Expo Mart", date: "2026-12-14", seats: 600, price: 2499 },
  { id: "e6", title: "Food & Wine Carnival", venue: "Goa Beachfront", date: "2026-12-22", seats: 450, price: 1299 },
];

export const users: User[] = [
  { id: "u1", name: "Aarav Sharma", email: "aarav@mail.com", joined: "2026-02-11" },
  { id: "u2", name: "Priya Verma", email: "priya@mail.com", joined: "2026-03-04" },
  { id: "u3", name: "Rahul Mehta", email: "rahul@mail.com", joined: "2026-03-19" },
  { id: "u4", name: "Sneha Kapoor", email: "sneha@mail.com", joined: "2026-04-02" },
];

export const registrations: Registration[] = [
  { id: "r1", user: "Aarav Sharma", eventId: "e1", ticket: "VIP", status: "Confirmed" },
  { id: "r2", user: "Priya Verma", eventId: "e2", ticket: "Regular", status: "Confirmed" },
  { id: "r3", user: "Rahul Mehta", eventId: "e1", ticket: "Regular", status: "Pending" },
  { id: "r4", user: "Sneha Kapoor", eventId: "e5", ticket: "VIP", status: "Confirmed" },
  { id: "r5", user: "Aarav Sharma", eventId: "e3", ticket: "Regular", status: "Confirmed" },
];

export const payments: Payment[] = [
  { id: "p1", user: "Aarav Sharma", amount: 2999, method: "UPI", status: "Paid" },
  { id: "p2", user: "Priya Verma", amount: 899, method: "Card", status: "Paid" },
  { id: "p3", user: "Sneha Kapoor", amount: 4999, method: "Card", status: "Paid" },
  { id: "p4", user: "Rahul Mehta", amount: 1499, method: "UPI", status: "Pending" },
];

export const stats = {
  totalUsers: users.length,
  totalEvents: events.length,
  totalRegistrations: registrations.length,
  totalRevenue: payments.filter(p => p.status === "Paid").reduce((s, p) => s + p.amount, 0),
};

export const registrationsPerEvent = events.map(e => ({
  name: e.title.split(" ")[0],
  registrations: registrations.filter(r => r.eventId === e.id).length,
}));
