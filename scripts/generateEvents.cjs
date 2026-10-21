/* eslint-disable */
/**
 * Eventra demo-data generator.
 *
 * Reads public/data/states-cities.json and produces public/data/events.json —
 * a static, clearly-named file meant to be replaced later by real events from
 * the MySQL database / admin panel.
 *
 * Rules:
 *  - Tier 1 metros (TIER1_CITIES): 5–7 events each, ≥4 distinct categories.
 *  - Every other city in the dropdown data: 1–2 events.
 *  - Fixed random seed → identical SHAPE on every run; event DATES are
 *    generated relative to the current date (today +7 … +120 days) so the
 *    data never expires.
 *  - Weekday/weekend mix across the window.
 *
 * Usage:  node scripts/generateEvents.cjs
 * Verify: node scripts/validateEvents.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "public/data/states-cities.json");
const OUTPUT = path.join(ROOT, "public/data/events.json");

// Dates are generated relative to the CURRENT date (today + 7 … +120 days) so
// the dataset never expires. The seeded PRNG keeps the SHAPE (which city gets
// which category/venue/price) identical across runs; only the absolute dates
// shift forward as time passes.
function anchorDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const ANCHOR = anchorDate();

// ── Seeded PRNG (mulberry32) — deterministic output ──────────────────
const SEED = 20260924;
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const intBetween = (min, max) => min + Math.floor(rand() * (max - min + 1));
/** Fisher–Yates with the seeded rand; returns a copy. */
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Tiers ────────────────────────────────────────────────────────────
// "Delhi" from the requirement maps to "New Delhi" (the city used in the data).
const TIER1_CITIES = new Set([
  "Mumbai", "New Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
  "Pune", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Kanpur", "Nagpur",
  "Indore", "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Coimbatore",
  "Kochi",
]);

// ── Content pools ────────────────────────────────────────────────────
const CATEGORIES = [
  "Music", "Tech and Startup", "Food Festival", "Sports", "Art and Culture",
  "Comedy", "Business and Networking", "Workshop", "Fitness", "Education",
  "Charity",
];

const GENRES = {
  Music: ["Bollywood", "Indie", "Rock", "Carnatic", "Sufi", "Hip-Hop", "Folk", "Jazz"],
  Comedy: ["Standup", "Open Mic", "Improv", "Sketch"],
};

const VENUES_TIER1 = [
  "{city} International Convention Centre",
  "{city} Metropolitan Stadium",
  "Grand Arena, {city}",
  "{city} World Trade Centre — Hall A",
  "Phoenix Marketcity Courtyard, {city}",
  "{city} Science Centre Auditorium",
  "City Carnival Grounds, {city}",
];
const VENUES_TIER2 = [
  "{city} Town Hall",
  "Government College Ground, {city}",
  "{city} Community Hall",
  "Municipal Auditorium, {city}",
  "{city} Sports Club Ground",
  "Nehru Yuva Kendra Hall, {city}",
];

// Category → [title templates] (most weave the city in, so titles stay
// unique across cities; a dedupe pass appends " — {city}" if ever needed).
const TITLES = {
  Music: [
    "{genre} Live: {city} Night",
    "{city} Sunset Concert",
    "{genre} Unplugged — {city}",
    "{city} Open Air Music Fest",
    "Raat ke Raags: {city} Edition",
    "{city} Indie Band Clash",
    "Sufi Nights: {city}",
    "{genre} On The Rocks, {city}",
  ],
  "Tech and Startup": [
    "{city} Hackathon",
    "Startup Showcase {city}",
    "{city} Dev Meetup",
    "AI & Builders Day, {city}",
    "{city} ProductTank Meetup",
    "Pitch Perfect: {city} Founders Night",
    "{city} Cloud & DevOps Day",
    "Hack The City: {city}",
  ],
  "Food Festival": [
    "{city} Street Food Carnival",
    "Great {city} Food Truck Mela",
    "{city} Regional Thali Fest",
    "Dessert Walk: {city}",
    "{city} BBQ & Grill Weekend",
    "Spice Route Festival, {city}",
  ],
  Sports: [
    "{city} Box Cricket League",
    "{city} 5K & 10K Run",
    "{city} Badminton Open",
    "Kabaddi Kings Cup: {city}",
    "{city} Monsoon Football Cup",
    "{city} Floodlight Tennis Night",
  ],
  "Art and Culture": [
    "{city} Heritage Walk & Concert",
    "{city} Art & Craft Mela",
    "Rang Utsav: {city}",
    "{city} Theatre Night",
    "{city} Classical Dance evening",
    "Kala Haat: {city}",
  ],
  Comedy: [
    "{city} Standup Night",
    "{city} Comedy Open Mic",
    "LOL Weekend: {city}",
    "{genre} Hafla — {city}",
    "{city} Punchline Club Live",
  ],
  "Business and Networking": [
    "{city} Founders Breakfast",
    "{city} Business Networking Mixers",
    "SME Growth Conclave, {city}",
    "{city} Investors Roundtable",
    "Women In Business: {city}",
  ],
  Workshop: [
    "{city} Photography Workshop",
    "{city} Pottery & Craft Workshop",
    "Public Speaking Lab: {city}",
    "{city} Coding Bootcamp Day",
    "{city} Film-making Workshop",
  ],
  Fitness: [
    "{city} Sunrise Yoga Jam",
    "{city} Fitness Bootcamp",
    "Zumba Night: {city}",
    "{city} Cyclothon",
    "Strength Camp: {city}",
  ],
  Education: [
    "{city} Career Fair",
    "{city} Study Abroad Expo",
    "Skill Summit: {city}",
    "{city} Science Quiz Championship",
    "UpSkill Live: {city}",
  ],
  Charity: [
    "{city} Charity Gala Night",
    "{city} Donation Drive & Mela",
    "Run For Hope: {city}",
    "{city} Fundraiser Concert",
    "Daan Utsav: {city}",
  ],
};

const DESCRIPTIONS = {
  Music: [
    "An evening of {genre} music with local artists and food stalls.",
    "Live bands, indie acts and a headlining act to close the night.",
  ],
  "Tech and Startup": [
    "Build sprints, demos and mentoring from senior engineers.",
    "Founders demo their products; investors in the audience.",
  ],
  "Food Festival": [
    "Dozens of stalls serving the city's favourite street eats.",
    "Local chefs, live counters and a dessert bazaar.",
  ],
  Sports: [
    "Open-registration tournament with prizes for top teams.",
    "Community sports day — bring your squad or join a house team.",
  ],
  "Art and Culture": [
    "Local artists, crafts and performances across the venue.",
    "A curated walk through the city's culture, ending with a show.",
  ],
  Comedy: [
    "A tight lineup of comedians testing fresh material.",
    "Sign up on the spot or just laugh from the seats.",
  ],
  "Business and Networking": [
    "Structured networking with founders, freelancers and SMEs.",
    "Panel discussion followed by open networking over chai.",
  ],
  Workshop: [
    "Hands-on session — all materials provided, beginners welcome.",
    "Small-batch workshop led by working professionals.",
  ],
  Fitness: [
    "Guided group session for all levels; mats provided.",
    "High-energy group workout with certified trainers.",
  ],
  Education: [
    "Meet colleges, counselors and alumni under one roof.",
    "Talks and Q&A to plan your next career move.",
  ],
  Charity: [
    "All proceeds go to local NGOs; entry includes a thank-you kit.",
    "Volunteer-run fundraiser with performances and stalls.",
  ],
};

const TIMES = ["10:00 AM", "11:30 AM", "2:00 PM", "4:00 PM", "5:30 PM", "6:30 PM", "7:00 PM", "8:00 PM"];

// Category → image key (maps onto the 6 inlined demo images).
const CATEGORY_IMAGE = {
  Music: "entertainment",
  Comedy: "entertainment",
  "Tech and Startup": "hackathon",
  Workshop: "technical",
  "Business and Networking": "technical",
  Education: "technical",
  "Art and Culture": "cultural",
  "Food Festival": "cultural",
  Sports: "general",
  Fitness: "general",
  Charity: "general",
};

// ── Date helpers ─────────────────────────────────────────────────────
function toDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Random date today+7..+120 days, nudged to a weekend/weekday by parity. */
function futureDate(index) {
  let d = new Date(ANCHOR);
  d.setDate(d.getDate() + intBetween(7, 120));
  const wantWeekend = index % 2 === 0; // guarantees a weekday/weekend mix
  const delta = (dir) => {
    d.setDate(d.getDate() + dir);
    return d.getDay();
  };
  if (wantWeekend) {
    while (d.getDay() !== 0 && d.getDay() !== 6) delta(1);
  } else {
    while (d.getDay() === 0 || d.getDay() === 6) delta(1);
  }
  return toDateOnly(d);
}

// ── Generation ───────────────────────────────────────────────────────
const statesCities = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const usedTitles = new Set();

function uniqueTitle(category, city) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const t = pick(TITLES[category])
      .replaceAll("{genre}", pick(GENRES[category] ?? ["Special"]))
      .replaceAll("{city}", city);
    if (!usedTitles.has(t)) {
      usedTitles.add(t);
      return t;
    }
  }
  // Deterministic fallback: city suffix guarantees uniqueness.
  const base = `${pick(TITLES[category])}`.replaceAll("{genre}", pick(GENRES[category] ?? ["Special"])).replaceAll("{city}", city);
  let n = 2;
  let t = `${base} — ${city}`;
  while (usedTitles.has(t)) t = `${base} — ${city} ${n++}`;
  usedTitles.add(t);
  return t;
}

function makeEvent(id, city, state, category, index) {
  const tier1 = TIER1_CITIES.has(city);
  const venuePool = tier1 ? VENUES_TIER1 : VENUES_TIER2;

  const free = rand() < 0.25;
  const price = free
    ? 0
    : tier1
      ? intBetween(3, 30) * 50      // ₹150–₹1500
      : intBetween(1, 10) * 50;     // ₹50–₹500

  const total = tier1 ? intBetween(6, 100) * 50 : intBetween(80, 600);
  const available = Math.max(5, Math.round(total * (0.05 + rand() * 0.9)));

  const genre = pick(GENRES[category] ?? ["Special"]);
  const venue = pick(venuePool).replaceAll("{city}", city);

  return {
    id,
    title: uniqueTitle(category, city),
    category,
    description: pick(DESCRIPTIONS[category]).replaceAll("{genre}", genre),
    date: futureDate(index),
    time: pick(TIMES),
    venue,
    city,
    state,
    price,
    totalSeats: total,
    seats: available, // available seats (frontend field name)
    image: `/events/${CATEGORY_IMAGE[category]}.png`,
  };
}

let id = 1;
let eventIndex = 0;
const events = [];

for (const { state, cities } of statesCities) {
  for (const city of cities) {
    const tier1 = TIER1_CITIES.has(city);
    const count = tier1 ? intBetween(5, 7) : intBetween(1, 2);
    // Distinct category draws: shuffled list guarantees Tier 1 cities get
    // count (≥5) *different* categories, beating the ≥4 requirement.
    const cats = shuffled(CATEGORIES).slice(0, count);
    for (const category of cats) {
      events.push(makeEvent(id++, city, state, category, eventIndex++));
    }
  }
}

events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

fs.writeFileSync(OUTPUT, JSON.stringify(events, null, 2) + "\n");

const tier1Count = events.filter((e) => TIER1_CITIES.has(e.city)).length;
console.log(
  `✅ ${events.length} events → public/data/events.json ` +
    `(${statesCities.reduce((n, s) => n + s.cities.length, 0)} cities, ` +
    `${tier1Count} in Tier-1 metros)`
);
