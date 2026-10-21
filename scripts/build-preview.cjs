/* eslint-disable */
// Self-contained Eventra preview builder:
// 1. fetch() interception — serves the app rich demo data (no server needed)
// 2. /events/*.png image redirects to downscaled JPGs
// 3. Inlines the production JS bundle as a base64 data-URL module
// 4. Extracts the inlined CSS from the built HTML for immediate paint
const fs = require("fs");

// ── 1. Read built bundle (entry chunk referenced by dist/index.html) ─
// NOTE: shipped uncompressed — blob-URL modules don't honor Content-Encoding,
// so gzip would reach the browser as binary garbage.
const distHtml = fs.readFileSync("dist/index.html", "utf8");
const entryMatch = distHtml.match(/<script type="module"[^>]*src="(\/assets\/[^"]+\.js)"/);
const jsFile = entryMatch ? entryMatch[1].replace("/assets/", "")
  : fs.readdirSync("dist/assets").filter(f => f.endsWith(".js"))
      .map(f => ({ f, size: fs.statSync("dist/assets/" + f).size }))
      .sort((a, b) => b.size - a.size)[0].f;
const js = fs.readFileSync("dist/assets/" + jsFile);
const b64 = js.toString("base64");
console.log("bundle file:", jsFile, "→ base64", (b64.length / 1048576).toFixed(2), "MB");
// (b64 computed above)

// ── 2. Read built CSS (extracted from dist HTML) ─────────────────────
const html = fs.readFileSync("dist/index.html", "utf8");
const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="[^"]*"[^>]*>/);
let css = "";
const cssFileMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
if (cssFileMatch) {
  css = fs.readFileSync("dist" + cssFileMatch[1], "utf8");
} else {
  console.warn("WARN: no css link found in dist/index.html");
}
console.log("css:", (css.length / 1024).toFixed(0), "KB");

// ── 3. Inline images as data URLs ────────────────────────────────────
const imgs = {};
for (const f of fs.readdirSync("/tmp/ev-imgs")) {
  imgs[f.replace(".jpg", "")] =
    "data:image/jpeg;base64," + fs.readFileSync("/tmp/ev-imgs/" + f).toString("base64");
}
console.log("images inlined:", Object.keys(imgs).join(", "), "→", Math.round(JSON.stringify(imgs).length / 1024), "KB base64");

// ── 4. Demo API data ─────────────────────────────────────────────────
// Events come from the generated dataset (scripts/generateEvents.cjs →
// public/data/events.json): 1–2 events per city, 5–7 per Tier-1 metro.
// Images stay as /events/*.png paths (kept tiny) and are expanded to the
// inlined JPEG data URLs at render time by the image hooks below.
let demoEvents = [];
try {
  demoEvents = JSON.parse(fs.readFileSync("public/data/events.json", "utf8"));
} catch (e) {
  console.warn("WARN: public/data/events.json missing — run scripts/generateEvents.cjs");
}
console.log("demo events:", demoEvents.length);

// QR code shown in the ticket dialog (static payload "EVENTRA-DEMO").
// Regenerate with: node -e "require('qrcode').toDataURL('EVENTRA-DEMO').then(console.log)"
const demoQr = "iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA+VemSAAAAAklEQVR4AewaftIAAAS+SURBVO3BgW0cCRADQZK4/FPmOwJhBKx+Tbmr3D8EYFIEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYNZH32Bb+FpbXdjWVVs9zbYu2upptoWvtdVFBGBWBGBWBGBWBGBWBGBWBGBWBGBWBGBWBGDWRz+grX4b23pSW13Z1kVbXbXVhW1dtdWT2uq3sa0nRQBmRQBmRQBmRQBmRQBmRQBmRQBmRQBmRQBmRQBmffQy23pLW73Ftp5mW09rqwW29Za2eksEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYNZHeEVbXdnW09oK+yIAsyIAsyIAsyIAsyIAsyIAsyIAsyIAsyIAsyIAsz7Cr9FWV7b1tLbC/ysCMCsCMCsCMCsCMCsCMCsCMCsCMCsCMCsCMOujl7XVv8i28Jy2+hdFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZ99ANsC89pqwvbumqrC9t6i23haxGAWRGAWRGAWRGAWRGAWRGAWRGAWRGAWRGAWR99Q1vhGW31r2orPCMCMCsCMCsCMCsCMCsCMCsCMCsCMCsCMCsCMOujb7Cti7a6sq2LtnqTbT2pra5s6y1t9Rbbumqrp9nWRVtd2dZFW11EAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGa5f+hhtvWmtsLXbOuira5s6zdpqwvbumqrJ0UAZkUAZkUAZkUAZkUAZkUAZkUAZkUAZkUAZrl/aIBtPa2trmzroq0ubOtpbXVlW29pq6fZ1kVbXdnWRVtd2dZFW11EAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZFAGZ99A22taCtLmzrqq0ubOtpbfWWtrqyrQvbWtBWF7Z11VZPigDMigDMigDMigDMigDMigDMigDMigDMigDM+ugHtNWVbV201ZVtPc22ntRWC2zrLW11ZVtPs62/XQRgVgRgVgRgVgRgVgRgVgRgVgRgVgRgVgRgVgRglvuH8L+zrTe11d/Otq7a6mm2ddFWV7Z10VYXEYBZEYBZEYBZEYBZEYBZEYBZEYBZEYBZEYBZH32DbeFrbfW0tlpgW09qqyvbumirq7a6sK23RABmRQBmRQBmRQBmRQBmRQBmRQBmRQBmRQBmffQD2uq3sa0ntdWVbV201dNs66qt/na2ddVWF211ZVtPigDMigDMigDMigDMigDMigDMigDMigDMigDMigDM+uhltvWWtlrQVhe2ddVWF211ZVtvaasL27qyrYu2eksEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYNZH+OvZ1tNs66Kt8Jy2elIEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYFYEYNZHeIVtPa2trmzrwrae1lZPs62LtrqyrQvbelpbXUQAZkUAZkUAZkUAZkUAZkUAZkUAZkUAZkUAZn30srb6F7XVlW29pa2ubOvCtha01dNs60kRgFkRgFkRgFkRgFkRgFkRgFkRgFkRgFkRgFkRgFkf/QDbwtds66qt3mJbb2mrp9nWbxIBmBUBmBUBmBUBmBUBmBUBmBUBmBUBmBUBmOX+IQCTIgCzIgCzIgCzIgCzIgCzIgCzIgCzIgCzIgCz/gPtMhT1RbtJKQAAAABJRU5ErkJggg==";

// ── Derived demo records so the upgraded pages have real content ──
const demoUsers = [
  { id: 1, name: "Aditya Prakash", email: "aditya@srmist.edu.in", joined: "2026-04-30" },
  { id: 2, name: "Priya Sharma", email: "priya@gmail.com", joined: "2026-05-14" },
  { id: 3, name: "Rahul Verma", email: "rahul@yahoo.com", joined: "2026-06-02" },
  { id: 4, name: "Sneha Iyer", email: "sneha@gmail.com", joined: "2026-06-21" },
  { id: 5, name: "Arjun Nair", email: "arjun@gmail.com", joined: "2026-07-08" },
  { id: 6, name: "Kavya Reddy", email: "kavya@srmist.edu.in", joined: "2026-08-01" },
  { id: 7, name: "Mohammed Ali", email: "ali@yahoo.com", joined: "2026-08-19" },
  { id: 8, name: "Ishita Bose", email: "ishita@gmail.com", joined: "2026-09-05" },
  { id: 9, name: "Rohan Gupta", email: "rohan@gmail.com", joined: "2026-09-12" },
  { id: 10, name: "Meera Krishnan", email: "meera@srmist.edu.in", joined: "2026-09-18" },
  { id: 11, name: "Dev Patel", email: "dev@yahoo.com", joined: "2026-09-22" },
  { id: 12, name: "Ananya Rao", email: "ananya@gmail.com", joined: "2026-09-26" },
];
const MY_NAME = "Aditya Prakash";
const demoRegistrations = [];
const demoPayments = [];
const demoCodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function demoCode(n) {
  let x = ((Number(n) + 1) * 2654435761) % 99991;
  let body = "";
  for (let i = 0; i < 12; i++) {
    x = (x * 31 + 7) % 99991;
    body += demoCodeAlphabet[x % demoCodeAlphabet.length];
  }
  let sum = 0;
  for (let j = 0; j < body.length; j++) sum = (sum * 31 + demoCodeAlphabet.indexOf(body[j])) % 997;
  return "EVTR-" + body + "-" + demoCodeAlphabet[sum % 32] + demoCodeAlphabet[Math.floor(sum / 32) % 32];
}
const payMethods = ["UPI", "Card", "Razorpay"];
// Synthesize a few PAST events so My-Tickets "past", attendance stats and
// event reviews have real data in the demo (the generator only makes future ones).
for (let i = 0; i < 8 && demoEvents.length > 0; i++) {
  const src = demoEvents[(i * 37) % demoEvents.length];
  const d = new Date(Date.now() - (14 + i * 11) * 86400000);
  demoEvents.push({
    ...src,
    id: 90000 + i,
    date: d.toISOString().slice(0, 10),
    seats: Math.max(0, Math.round(src.seats * 0.08)),
  });
}
const sortedEvents = [...demoEvents].sort((a, b) => String(a.date).localeCompare(String(b.date)));
const todayIso = new Date().toISOString().slice(0, 10);
const upcomingEvents = sortedEvents.filter((e) => String(e.date) >= todayIso);
const pastEvents = sortedEvents.filter((e) => String(e.date) < todayIso).reverse();
let regSeq = 0;
let paySeq = 0;
function addCrowd(ev, isPast) {
  const fill = ev.totalSeats > 0 ? ev.totalSeats - ev.seats : 0;
  const n = Math.max(1, Math.min(4, Math.round(fill / 12) || 2));
  for (let k = 0; k < n; k++) {
    const u = demoUsers[(ev.id * 7 + k * 3) % demoUsers.length];
    if (u.name === MY_NAME) continue;
    const vip = (ev.id + k) % 4 === 0;
    const amount = Number(ev.price) > 0 ? (vip ? ev.price * 2 : ev.price) : 0;
    const at = new Date(new Date(ev.date).getTime() - (5 + (k % 4)) * 86400000).toISOString();
    demoRegistrations.push({
      id: ++regSeq, user: u.name, userId: u.id, eventId: ev.id,
      ticket: vip ? "VIP" : "Regular", status: "Confirmed",
      totalAmount: amount, ticketCode: demoCode(regSeq), registeredAt: at,
      checkedInAt: isPast ? new Date(new Date(ev.date).getTime() + 3 * 3600000).toISOString() : null,
      event: { id: ev.id, title: ev.title, date: ev.date },
    });
    if (amount > 0) demoPayments.push({ id: ++paySeq, user: u.name, amount, method: payMethods[(ev.id + k) % 3], status: "Paid", createdAt: at });
  }
}
upcomingEvents.slice(0, 60).forEach((ev) => addCrowd(ev, false));
pastEvents.slice(0, 30).forEach((ev) => addCrowd(ev, true));
// The signed-in demo user: 3 upcoming (paid, different cities) + 2 past (attended).
function addMine(ev, vip, past) {
  const amount = Number(ev.price) > 0 ? (vip ? ev.price * 2 : ev.price) : 0;
  const reg = {
    id: ++regSeq, user: MY_NAME, userId: 1, eventId: ev.id,
    ticket: vip ? "VIP" : "Regular", status: "Confirmed",
    totalAmount: amount, ticketCode: demoCode(regSeq),
    registeredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    checkedInAt: null,
    event: { id: ev.id, title: ev.title, date: ev.date },
  };
  if (past) reg.checkedInAt = new Date(new Date(ev.date).getTime() + 3 * 3600000).toISOString();
  demoRegistrations.push(reg);
  if (amount > 0) demoPayments.push({ id: ++paySeq, user: MY_NAME, amount, method: "Razorpay", status: "Paid", createdAt: reg.registeredAt });
  return reg;
}
const myUpcomingCities = new Set();
for (const ev of upcomingEvents) {
  if (Number(ev.price) > 0 && !myUpcomingCities.has(ev.city)) {
    myUpcomingCities.add(ev.city);
    addMine(ev, myUpcomingCities.size === 1, false);
    if (myUpcomingCities.size === 3) break;
  }
}
pastEvents.slice(0, 2).forEach((ev) => addMine(ev, false, true));
// Reviews seeded on every attended event.
const demoFeedback = {};
(function seedFeedback() {
  const seen = new Set();
  const quotes = [
    ["Electric atmosphere — brilliantly organised.", 5],
    ["Great venue and smooth check-in.", 4],
    ["Loved every session. Will attend again!", 5],
  ];
  for (const r of demoRegistrations) {
    if (!r.checkedInAt || seen.has(r.eventId)) continue;
    seen.add(r.eventId);
    demoFeedback[r.eventId] = demoUsers.slice(0, 3).map((u, k) => ({
      id: (r.eventId % 97) * 10 + k + 1, userId: u.id, user: u.name,
      rating: quotes[k][1], review: quotes[k][0], createdAt: r.checkedInAt,
    }));
  }
})();
const regCountByEvent = {};
demoRegistrations.forEach((r) => { regCountByEvent[r.eventId] = (regCountByEvent[r.eventId] || 0) + 1; });
const registrationsPerEvent = Object.entries(regCountByEvent)
  .map(([id, c]) => ({ name: (demoEvents.find((e) => e.id === Number(id)) || {}).title || "Event", registrations: c }))
  .sort((a, b) => b.registrations - a.registrations)
  .slice(0, 6);
const demoNotifications = [
  { id: 1, type: "ticket", title: "Your ticket is ready", message: "QR e-ticket issued for " + (myUpcomingEventsShow(0) || {}).title + ".", link: "/tickets", read: false, time: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 2, type: "registration", title: "Registration confirmed", message: "See you at " + (myUpcomingEventsShow(0) || {}).title + "!", link: "/tickets", read: false, time: new Date(Date.now() - 2 * 3600100).toISOString() },
  { id: 3, type: "waitlist", title: "You're off the waitlist", message: "A seat opened up — your booking is confirmed.", link: "/tickets", read: true, time: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: 4, type: "reminder", title: "Event tomorrow", message: (myUpcomingEventsShow(1) || {}).title + " starts soon — check the venue map.", link: "/events", read: true, time: new Date(Date.now() - 30 * 3600000).toISOString() },
  { id: 5, type: "update", title: "Schedule update", message: "Doors open 30 minutes earlier than planned.", link: "/events", read: true, time: new Date(Date.now() - 50 * 3600000).toISOString() },
];
function myUpcomingEventsShow(i) {
  const mine = demoRegistrations.filter((r) => r.user === MY_NAME);
  const up = mine.filter((r) => r.event && String(r.event.date) >= todayIso);
  return up[i] ? demoEvents.find((e) => e.id === up[i].eventId) : null;
}
const demoSaved = [...upcomingEvents.slice(3, 5).map((e) => e.id), pastEvents[0] ? pastEvents[0].id : null].filter(Boolean);
const demoProfile = {
  id: 1, name: MY_NAME, email: "aditya@srmist.edu.in", role: "admin",
  phone: "+91 98400 12345", bio: null, interests: ["Tech", "Music"],
  state: null, city: "Chennai", joined: "2026-04-30",
};

const demo = {
  events: demoEvents,
  users: demoUsers,
  registrations: demoRegistrations,
  payments: demoPayments,
  stats: {
    totalUsers: demoUsers.length,
    totalEvents: demoEvents.length,
    totalRegistrations: demoRegistrations.length,
    totalRevenue: demoPayments.reduce((s, p) => s + p.amount, 0),
  },
  registrationsPerEvent,
  feedback: demoFeedback,
  notifications: demoNotifications,
  saved: demoSaved,
  waitlist: [],
  profile: demoProfile,
  qrDataUrl: demoQr,
};

// Location dropdown fallback data (inlined so preview works offline)
try {
  demo.statesCities = JSON.parse(fs.readFileSync("public/data/states-cities.json", "utf8"));
} catch (e) {
  console.warn("WARN: public/data/states-cities.json missing — offline fallback limited");
  demo.statesCities = [];
}

// ── 5. Boot-strap script (runs BEFORE the app bundle) ────────────────
const bootstrap = `
/* Eventra preview shim: mock API + image redirect */
/* The app uses HashRouter for static-file builds, so no URL rewriting is needed. */
const __demo = ${JSON.stringify(demo)};
__demo.seq = 100; // id counter for created records
window.__demo = __demo;

// signed-in demo user
try { localStorage.setItem("ef_user", JSON.stringify({ id: 1, name: "Aditya Prakash", email: "aditya@srmist.edu.in", role: "admin" })); } catch (e) {}

// image redirect: /events/*.png → inlined JPEG data URLs
function __mapImg(v) {
  if (typeof v === "string" && v.indexOf("/events/") === 0) {
    var key = v.replace("/events/", "").replace(".png", "");
    if (__demo.__imgs[key]) return __demo.__imgs[key];
  }
  return v;
}
(function () {
  var orig = document.createElement;
  document.createElement = function (tag) {
    var el = orig.apply(this, arguments);
    if (String(tag).toLowerCase() === "img") {
      var set = el.setAttribute.bind(el);
      el.setAttribute = function (name, value) {
        if (name === "src") value = __mapImg(value);
        return set(name, value);
      };
    }
    return el;
  };
})();
// also catch direct property assignment (img.src = ...) which skips setAttribute
try {
  var __srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    set: function (v) { __srcDesc.set.call(this, __mapImg(v)); },
    get: __srcDesc.get,
    configurable: true,
  });
} catch (e) {}

// fetch interception — STATEFUL: payments/registrations mutate the demo data,
// so dashboard stats (total revenue etc.) move in real time like the real app.
var __nativeFetch = window.fetch;
window.fetch = function (input, init) {
  var url = typeof input === "string" ? input : (input && input.url) || "";
  // External requests (map geocoding, tiles, fonts…) hit the real network —
  // only intercept the app's own /api and /data calls.
  if (url.indexOf("/") !== 0) return __nativeFetch(input, init);
  var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
  var body = {};
  try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) {}
  function reply(bd, status) {
    return Promise.resolve(new Response(JSON.stringify(bd), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    }));
  }

  if (method === "POST") {
    if (url.indexOf("/api/registrations") === 0) {
      var evReg = __demo.events.find(function (e) { return e.id === Number(body.eventId); });
      var reg = {
        id: ++__demo.seq,
        user: body.user || "Guest",
        eventId: Number(body.eventId),
        ticket: body.ticket || "Regular",
        status: "Confirmed",
        event: evReg ? { id: evReg.id, title: evReg.title } : null,
      };
      __demo.registrations.unshift(reg);
      __demo.stats.totalRegistrations = __demo.registrations.length;
      return reply(reg, 201);
    }
    if (url.indexOf("/api/payments") === 0) {
      var pay = {
        id: ++__demo.seq,
        user: body.user || "Guest",
        amount: Number(body.amount) || 0,
        method: body.method || "Razorpay",
        status: body.status || "Paid",
      };
      __demo.payments.unshift(pay);
      if (pay.status === "Paid") __demo.stats.totalRevenue += pay.amount;
      return reply(pay, 201);
    }
    if (url.indexOf("/api/events") === 0) {
      var evNew = {
        id: ++__demo.seq,
        title: body.title || "Untitled event",
        venue: body.venue || "",
        state: body.state || null,
        city: body.city || null,
        date: body.date || "",
        seats: Number(body.seats) || 0,
        price: Number(body.price) || 0,
        category: body.category || "General",
        image: "/events/general.png",
      };
      __demo.events.unshift(evNew);
      __demo.stats.totalEvents = __demo.events.length;
      return reply(evNew, 201);
    }
  }

  if (method === "PUT" && url.indexOf("/api/events/") === 0) {
    var upId = Number(url.split("/")[3]);
    var upEv = __demo.events.find(function (e) { return e.id === upId; });
    if (!upEv) return reply({ success: false, error: "Event not found" }, 404);
    if (body.title) upEv.title = body.title;
    if (body.venue !== undefined) upEv.venue = body.venue;
    if (body.date) upEv.date = body.date;
    if (body.seats != null) upEv.seats = Number(body.seats);
    if (body.price != null) upEv.price = Number(body.price);
    if (body.category) upEv.category = body.category;
    if (body.description !== undefined) upEv.description = body.description;
    return reply(upEv);
  }

  if (method === "DELETE") {
    var m = url.match(/\\/api\\/events\\/(\\d+)/);
    if (m) {
      var delId = Number(m[1]);
      __demo.events = __demo.events.filter(function (e) { return e.id !== delId; });
      __demo.stats.totalEvents = __demo.events.length;
      return reply({ success: true }, 200);
    }
  }

  if (url.indexOf("/api/stats/registrations-per-event") === 0) return reply(__demo.registrationsPerEvent);
  if (url.indexOf("/api/stats") === 0) return reply(__demo.stats);
  if (url.indexOf("/data/states-cities.json") === 0) return reply(__demo.statesCities || []);
  if (url.indexOf("/api/events/locations") === 0) {
    var byState = {};
    __demo.events.forEach(function (e) {
      if (!e.state || !e.city) return;
      (byState[e.state] = byState[e.state] || []).push(e.city);
    });
    var locs = Object.keys(byState).sort().map(function (s) {
      return { state: s, cities: Array.from(new Set(byState[s])).sort() };
    });
    return reply(locs);
  }
  // ── New-phase endpoints: profile / saved / notifications / waitlist / feedback ──
  if (url.indexOf("/api/profile") === 0 && method === "PUT") {
    if (body.interests) __demo.profile.interests = body.interests;
    if (body.name) __demo.profile.name = body.name;
    if (body.phone !== undefined) __demo.profile.phone = body.phone;
    if (body.city !== undefined) __demo.profile.city = body.city;
    return reply({ success: true, profile: __demo.profile });
  }
  if (url.indexOf("/api/profile/password") === 0) return reply({ success: true });
  if (url.indexOf("/api/profile") === 0) {
    var mineRegs = __demo.registrations.filter(function (r) { return r.user === __demo.profile.name; });
    var todayStr = new Date().toISOString().slice(0, 10);
    var upcoming = mineRegs.filter(function (r) { return r.event && String(r.event.date) >= todayStr; }).length;
    var attended = mineRegs.filter(function (r) { return !!r.checkedInAt; }).length;
    var mySavedCount = __demo.saved.length;
    var myReviews = Object.keys(__demo.feedback).filter(function (eid) {
      return (__demo.feedback[eid] || []).some(function (f) { return f.userId === 1; });
    }).length;
    return reply({
      profile: __demo.profile,
      activity: { totalRegistrations: mineRegs.length, upcoming: upcoming, attended: attended, savedEvents: mySavedCount, reviewsWritten: myReviews },
      registrations: mineRegs.map(function (r) {
        var full = __demo.events.find(function (e) { return e.id === r.eventId; });
        return {
          id: r.id, status: r.status, ticketType: r.ticket, ticketCode: r.ticketCode,
          totalAmount: r.totalAmount, registeredAt: r.registeredAt, checkedInAt: r.checkedInAt,
          event: full ? { id: full.id, title: full.title, date: full.date, venue: full.venue, city: full.city, category: full.category, upcoming: String(full.date) >= todayStr } : null,
        };
      }),
    });
  }
  if (url.indexOf("/api/saved/") === 0 && method === "DELETE") {
    var delId2 = Number(url.split("/")[3]);
    __demo.saved = __demo.saved.filter(function (x) { return x !== delId2; });
    return reply({ success: true, saved: false });
  }
  if (url.indexOf("/api/saved") === 0 && method === "POST") {
    var sid = Number(body.eventId);
    if (__demo.saved.indexOf(sid) === -1) __demo.saved.push(sid);
    return reply({ success: true, saved: true });
  }
  if (url.indexOf("/api/saved") === 0) {
    return reply(__demo.saved.map(function (sid) { return __demo.events.find(function (e) { return e.id === sid; }); }).filter(Boolean));
  }
  if (url.indexOf("/api/notifications/unread-count") === 0) {
    return reply({ count: __demo.notifications.filter(function (n) { return !n.read; }).length });
  }
  if (url.indexOf("/api/notifications/read-all") === 0) {
    __demo.notifications.forEach(function (n) { n.read = true; });
    return reply({ success: true });
  }
  var notifMatch = url.match(/\\/api\\/notifications\\/(\\d+)/);
  if (notifMatch) {
    var nid = Number(notifMatch[1]);
    var nrow = __demo.notifications.find(function (n) { return n.id === nid; });
    if (!nrow) return reply({ success: false, error: "Not found" }, 404);
    if (method === "DELETE") {
      __demo.notifications = __demo.notifications.filter(function (n) { return n.id !== nid; });
      return reply({ success: true });
    }
    nrow.read = true;
    return reply({ success: true });
  }
  if (url.indexOf("/api/notifications") === 0 && method === "DELETE") {
    __demo.notifications = [];
    return reply({ success: true });
  }
  if (url.indexOf("/api/notifications") === 0) {
    var notifList = __demo.notifications.slice();
    var qn = String(url).split("?")[1] || "";
    if (qn.indexOf("unread=1") !== -1) notifList = notifList.filter(function (n) { return !n.read; });
    return reply(notifList);
  }
  if (url.indexOf("/api/waitlist") === 0) return reply(__demo.waitlist);
  if (url.indexOf("/api/feedback/mine") === 0) return reply([]);
  if (url.indexOf("/api/feedback/event/") === 0) {
    var fbid = Number(url.split("/")[4]);
    var rows = __demo.feedback[fbid] || [];
    var avg = rows.length ? rows.reduce(function (s, f) { return s + f.rating; }, 0) / rows.length : 0;
    var breakdown = {};
    rows.forEach(function (f) { breakdown[String(f.rating)] = (breakdown[String(f.rating)] || 0) + 1; });
    return reply({ reviews: rows, average: Math.round(avg * 10) / 10, count: rows.length, breakdown: breakdown });
  }
  if (url.indexOf("/api/feedback") === 0 && method === "POST") {
    var feid = Number(body.eventId);
    __demo.feedback[feid] = __demo.feedback[feid] || [];
    var existingMine = __demo.feedback[feid].filter(function (f) { return f.userId === 1; });
    if (existingMine.length > 0) {
      existingMine[0].rating = body.rating; existingMine[0].review = body.review || "";
      return reply({ success: true, updated: true });
    }
    __demo.feedback[feid].unshift({ id: Date.now() % 100000, userId: 1, user: __demo.profile.name, rating: body.rating, review: body.review || "", createdAt: new Date().toISOString() });
    return reply({ success: true });
  }
  // ── Tickets / QR / check-in / attendance ──
  if (url.indexOf("/api/tickets/checkin") === 0 && method === "POST") {
    var ccode = String(body.code || "").toUpperCase().replace(/\\s+/g, "");
    var creg = __demo.registrations.filter(function (r) { return r.ticketCode && r.ticketCode.toUpperCase() === ccode; })[0];
    if (!creg) return reply({ success: false, valid: false, error: "Ticket not found in this demo dataset" }, 404);
    if (creg.checkedInAt) return reply({ success: true, valid: true, duplicate: true, checkedInAt: creg.checkedInAt, attendee: { name: creg.user, ticketType: creg.ticket, registrationId: creg.id }, event: creg.event });
    creg.checkedInAt = new Date().toISOString();
    return reply({ success: true, valid: true, duplicate: false, checkedInAt: creg.checkedInAt, attendee: { name: creg.user, ticketType: creg.ticket, registrationId: creg.id }, event: creg.event });
  }
  var tixStats = url.match(/\\/api\\/tickets\\/stats\\/(\\d+)/);
  if (tixStats) {
    var seid = Number(tixStats[1]);
    var evTitle = (__demo.events.find(function (e) { return e.id === seid; }) || {}).title;
    var evRegs = __demo.registrations.filter(function (r) { return r.eventId === seid && r.status === "Confirmed"; });
    var checkedIn = evRegs.filter(function (r) { return !!r.checkedInAt; }).length;
    return reply({ eventId: seid, eventTitle: evTitle, totalConfirmed: evRegs.length, checkedIn: checkedIn, pending: evRegs.length - checkedIn, attendanceRate: evRegs.length ? Math.round((checkedIn / evRegs.length) * 100) : 0, vipTickets: evRegs.filter(function (r) { return r.ticket === "VIP"; }).length });
  }
  var tixAtt = url.match(/\\/api\\/tickets\\/attendees\\/(\\d+)/);
  if (tixAtt) {
    var aqid = Number(tixAtt[1]);
    var aregs = __demo.registrations.filter(function (r) { return r.eventId === aqid && r.user !== __demo.profile.name; });
    return reply(aregs.map(function (r) { return { registrationId: r.id, ticketCode: r.ticketCode, ticketType: r.ticket, status: r.status, registeredAt: r.registeredAt, checkedInAt: r.checkedInAt, amount: r.totalAmount, name: r.user, email: ((__demo.users.find(function (u) { return u.name === r.user; }) || {}).email || "") }; }));
  }
  if (url.indexOf("/api/tickets") === 0) {
    var mine = __demo.registrations.filter(function (r) { return r.user === __demo.profile.name; });
    var todayStr2 = new Date().toISOString().slice(0, 10);
    var toShape = function (r) {
      var full = __demo.events.find(function (e) { return e.id === r.eventId; });
      return {
        registrationId: r.id, ticketCode: r.ticketCode, ticketType: r.ticket, status: r.status,
        registeredAt: r.registeredAt, checkedInAt: r.checkedInAt, amount: r.totalAmount,
        event: full ? { id: full.id, title: full.title, venue: full.venue, city: full.city, state: full.state, category: full.category, image: full.image, startDate: full.date, endDate: null } : null,
        user: { id: 1, name: __demo.profile.name, email: __demo.profile.email },
      };
    };
    return reply({ upcoming: mine.filter(function (r) { return r.event && String(r.event.date) >= todayStr2; }).map(toShape), past: mine.filter(function (r) { return r.event && String(r.event.date) < todayStr2; }).map(toShape), total: mine.length });
  }
  // ── Predictions / recommendations / smart search ──
  if (url.indexOf("/api/predictions/recommendations") === 0) {
    var up = __demo.events.filter(function (e) { return String(e.date) >= new Date().toISOString().slice(0, 10); });
    var recs = up.slice(0, 12).map(function (e, k) {
      return { eventId: e.id, title: e.title, category: e.category, city: e.city, venue: e.venue, date: e.date, price: e.price, seats: e.seats, score: Math.round((0.95 - k * 0.06) * 100) / 100, reasons: k % 2 === 0 ? ["Matches your Tech interest", "In your city"] : ["Popular in " + e.city, "Similar attendees going"] };
    });
    return reply({ recommendations: recs, basedOn: true });
  }
  if (url.indexOf("/api/predictions/search/suggestions") === 0) {
    var sq = decodeURIComponent((String(url).split("q=")[1] || "").split("+").join(" ")).toLowerCase();
    var sug = [];
    if (sq.length >= 2) {
      __demo.events.slice(0, 200).forEach(function (e) {
        if (sug.length < 5 && e.title.toLowerCase().indexOf(sq) !== -1) sug.push({ type: "event", label: e.title, eventId: e.id });
        if (sug.length < 6 && e.city && e.city.toLowerCase().indexOf(sq) === 0) sug.push({ type: "city", label: e.city });
      });
      var seenCat = {};
      __demo.events.slice(0, 200).forEach(function (e) {
        if (sug.length < 8 && e.category && e.category.toLowerCase().indexOf(sq) === 0 && !seenCat[e.category]) { seenCat[e.category] = 1; sug.push({ type: "category", label: e.category, category: e.category }); }
      });
    }
    return reply({ suggestions: sug });
  }
  if (url.indexOf("/api/predictions/search") === 0) {
    var surl = String(url).split("?")[1] || "";
    var sqs = {};
    surl.split("&").forEach(function (pair) { if (!pair) return; var kv = pair.split("="); sqs[kv[0]] = decodeURIComponent((kv[1] || "").split("+").join(" ")); });
    var slist = __demo.events.filter(function (e) {
      var hay = ((e.title || "") + " " + (e.venue || "") + " " + (e.city || "") + " " + (e.category || "")).toLowerCase();
      if (sqs.q && hay.indexOf(sqs.q.toLowerCase()) === -1) return false;
      if (sqs.category && (e.category || "").toLowerCase() !== sqs.category.toLowerCase()) return false;
      if (sqs.city && (e.city || "").toLowerCase() !== sqs.city.toLowerCase()) return false;
      if (sqs.from && String(e.date) < sqs.from) return false;
      if (sqs.to && String(e.date) > sqs.to) return false;
      return true;
    });
    return reply({ results: slist, count: slist.length });
  }
  if (url.indexOf("/api/predictions") === 0) {
    var upP = __demo.events.filter(function (e) { return String(e.date) >= new Date().toISOString().slice(0, 10); }).slice(0, 24);
    var preds = upP.map(function (e, k) {
      var fill = e.totalSeats > 0 ? Math.round(((e.totalSeats - e.seats) / e.totalSeats) * 100) : 40;
      var pop = Math.min(97, 42 + fill * 0.4 + (k % 5) * 4);
      var label = pop >= 75 ? "High" : pop >= 55 ? "Medium" : "Low";
      return { eventId: e.id, title: e.title, category: e.category, city: e.city, startDate: e.date, capacity: e.totalSeats || e.seats, registered: Math.max(0, (e.totalSeats || e.seats) - e.seats), popularity: Math.round(pop), confidence: Math.round(70 + (k % 4) * 6), expectedAttendance: Math.round(((e.totalSeats || e.seats) * pop) / 100), trendPct: (k % 3 === 0 ? 1 : -1) * (8 + (k % 4) * 5), trend: k % 3 === 0 ? "up" : k % 3 === 1 ? "flat" : "down", label: label, emoji: label === "High" ? "🔥" : label === "Medium" ? "⚡" : "📉", color: label === "High" ? "high" : label === "Medium" ? "medium" : "low", signals: { demand: Math.round(pop), fill: fill, timing: 60 + (k % 3) * 10, category: 50 + (k % 6) * 5 } };
    });
    return reply({ generatedAt: new Date().toISOString(), predictions: preds });
  }
  // ── Organizer ──
  var annMatch = url.match(/\\/api\\/organizer\\/events\\/(\\d+)\\/announce/);
  if (annMatch && method === "POST") {
    var annEid = Number(annMatch[1]);
    var reached = __demo.registrations.filter(function (r) { return r.eventId === annEid; }).length;
    __demo.notifications.unshift({ id: Date.now() % 100000, type: "update", title: body.title, message: body.message, link: "/events/" + annEid, read: false, time: new Date().toISOString() });
    return reply({ success: true, reached: reached });
  }
  if (url.indexOf("/api/organizer/overview") === 0) {
    var todayOv = new Date().toISOString().slice(0, 10);
    var byEvent = {};
    __demo.registrations.forEach(function (r) { (byEvent[r.eventId] = byEvent[r.eventId] || []).push(r); });
    var perEvent = Object.keys(byEvent).map(function (eidStr) {
      var eid = Number(eidStr);
      var e = __demo.events.find(function (x) { return x.id === eid; });
      if (!e) return null;
      var regs = byEvent[eid];
      var rev = regs.reduce(function (s, r) { return s + Number(r.totalAmount || 0); }, 0);
      var ci = regs.filter(function (r) { return !!r.checkedInAt; }).length;
      var cap = e.totalSeats || e.seats || 0;
      var fb = __demo.feedback[eid] || [];
      var favg = fb.length ? fb.reduce(function (s, f) { return s + f.rating; }, 0) / fb.length : null;
      return { eventId: eid, title: e.title, startDate: e.date, capacity: cap, registered: regs.length, checkedIn: ci, revenue: rev, conversionRate: cap ? Math.round((regs.length / cap) * 100) : 0, attendanceRate: regs.length ? Math.round((ci / regs.length) * 100) : 0, avgRating: favg != null ? Math.round(favg * 10) / 10 : null };
    }).filter(Boolean);
    var totalRev = perEvent.reduce(function (s, e) { return s + e.revenue; }, 0);
    var totReg = perEvent.reduce(function (s, e) { return s + e.registered; }, 0);
    var totCi = perEvent.reduce(function (s, e) { return s + e.checkedIn; }, 0);
    var top = perEvent.slice().sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 5);
    var growth = [];
    for (var w = 7; w >= 0; w--) {
      var wEnd = Date.now() - w * 7 * 86400000;
      var wStart = wEnd - 7 * 86400000;
      var inWeek = __demo.registrations.filter(function (r) { var t = new Date(r.registeredAt).getTime(); return t >= wStart && t < wEnd; });
      growth.push({ label: "W-" + w, registrations: inWeek.length, revenue: inWeek.reduce(function (s, r) { return s + Number(r.totalAmount || 0); }, 0) });
    }
    return reply({ summary: { totalEvents: perEvent.length, totalRevenue: totalRev, totalRegistrations: totReg, totalCheckedIn: totCi, avgConversion: perEvent.length ? Math.round(perEvent.reduce(function (s, e) { return s + e.conversionRate; }, 0) / perEvent.length) : 0, avgAttendance: perEvent.length ? Math.round(perEvent.reduce(function (s, e) { return s + e.attendanceRate; }, 0) / perEvent.length) : 0 }, perEvent: perEvent, topEvents: top, growth: growth });
  }
  if (url.indexOf("/api/organizer") === 0) return reply({ success: true, eventId: 999 });
  if (url.indexOf("/api/events/") === 0) {
    var id = Number(url.split("/")[3]);
    var ev = __demo.events.find(function (e) { return e.id === id; });
    return ev ? reply(ev) : reply({ error: "Event not found" }, 404);
  }
  // NOTE: must come AFTER the "/api/events/" (single-event) branch above.
  if (url.indexOf("/api/events") === 0) {
    // location-first flow: honor ?state= and ?city= (case-insensitive).
    // Written with split/join instead of regex literals — this code passes
    // through a JS template literal, where backslashes are escape-prone.
    var qs = {};
    var qpart = String(url).split("?")[1] || "";
    qpart.split("&").forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split("=");
      var k = decodeURIComponent(kv[0].split("+").join(" "));
      var v = decodeURIComponent(kv.slice(1).join("=").split("+").join(" "));
      qs[k] = v;
    });
    var list = __demo.events;
    if (qs.state) list = list.filter(function (e) { return (e.state || "").toLowerCase() === qs.state.toLowerCase(); });
    if (qs.city) list = list.filter(function (e) { return (e.city || "").toLowerCase() === qs.city.toLowerCase(); });
    if (qs.category) list = list.filter(function (e) { return (e.category || "").toLowerCase() === qs.category.toLowerCase(); });
    return reply(list);
  }
  if (url.indexOf("/api/users") === 0) return reply(__demo.users);
  if (url.indexOf("/api/registrations") === 0) return reply(__demo.registrations);
  if (url.indexOf("/api/payments") === 0) return reply(__demo.payments);
  if (url.indexOf("/api/auth/login") === 0) return reply({ id: 1, name: "Aditya Prakash", email: "aditya@srmist.edu.in", role: "admin", token: "demo-token" });
  if (url.indexOf("/api/auth/signup") === 0) return reply({ ok: true });
  return reply({ error: "Preview API stub" }, 404);
};
`;

// imgs get referenced inside bootstrap via __demo.__imgs
const bootstrapFinal = bootstrap.replace(
  "__demo = " + JSON.stringify(demo) + ";",
  "__demo = " + JSON.stringify(demo) + ";\n__demo.__imgs = " + JSON.stringify(imgs) + ";"
);

// ── 6. Assemble final HTML ───────────────────────────────────────────
const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Eventra — Event Registration & Ticketing</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%236366f1'/%3E%3Cpath d='M40 12 20 36h10l-6 16 20-24H34l6-16z' fill='%23fff'/%3E%3C/svg%3E" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${bootstrapFinal}</script>
<script>
var gz = "${b64}";
var bin = atob(gz);
var bytes = new Uint8Array(bin.length);
for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
var blob = new Blob([bytes], { type: "text/javascript" });
import(URL.createObjectURL(blob));
</script>
</body>
</html>`;

fs.writeFileSync("preview.html", out);
console.log("✅ preview.html written:", (out.length / 1048576).toFixed(2), "MB");
