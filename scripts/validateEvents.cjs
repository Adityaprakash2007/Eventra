/**
 * Validates public/data/events.json against the coverage rules:
 *  1. every city in states-cities.json has ≥1 event
 *  2. every Tier 1 city has 5–7 events
 *  3. no duplicate ids
 *  4. all dates in the future
 *
 * Usage: node scripts/validateEvents.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const statesCities = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/states-cities.json"), "utf8")
);
const events = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/events.json"), "utf8")
);

const TIER1_CITIES = new Set([
  "Mumbai", "New Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
  "Pune", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Kanpur", "Nagpur",
  "Indore", "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Coimbatore",
  "Kochi",
]);const today = new Date();
today.setHours(0, 0, 0, 0);
const maxDate = new Date(today);
maxDate.setDate(maxDate.getDate() + 126); // ~4 months window
const errors = [];
const warnings = [];

// 1. every city covered
const byCity = new Map();
for (const e of events) {
  const key = `${e.state}|${e.city}`;
  byCity.set(key, (byCity.get(key) || 0) + 1);
}
let citiesTotal = 0;
for (const { state, cities } of statesCities) {
  for (const city of cities) {
    citiesTotal++;
    const n = byCity.get(`${state}|${city}`) || 0;
    if (n === 0) errors.push(`No events for ${city}, ${state}`);
    if (!TIER1_CITIES.has(city) && n < 1) errors.push(`Tier-2 ${city} has ${n} events (<1)`);
    if (!TIER1_CITIES.has(city) && n > 2) warnings.push(`Tier-2 ${city}, ${state} has ${n} events (>2)`);
  }
}

// 2. Tier 1 count 5–7 (city names are unique across states in this data)
for (const t1 of TIER1_CITIES) {
  const n = events.filter((e) => e.city === t1).length;
  if (n < 5 || n > 7) errors.push(`Tier-1 ${t1} has ${n} events (need 5–7)`);
  const cats = new Set(events.filter((e) => e.city === t1).map((e) => e.category));
  if (cats.size < 4) errors.push(`Tier-1 ${t1} has only ${cats.size} categories (need ≥4)`);
}

// 3. unique ids
const ids = new Set();
for (const e of events) {
  if (ids.has(e.id)) errors.push(`Duplicate event id: ${e.id}`);
  ids.add(e.id);
  for (const f of ["id", "title", "category", "description", "date", "time", "venue", "city", "state", "price", "totalSeats", "seats", "image"]) {
    if (e[f] === undefined || e[f] === null || e[f] === "") errors.push(`Event ${e.id} missing field ${f}`);
  }
  if (e.seats > e.totalSeats) errors.push(`Event ${e.id} seats > totalSeats`);
}

// 4. future dates (checked against the REAL current date, not a fixed anchor)
for (const e of events) {
  const d = new Date(`${e.date}T23:59:59`);
  if (d <= today) errors.push(`Event ${e.id} (${e.title}) date ${e.date} is not in the future`);
  if (d > maxDate) warnings.push(`Event ${e.id} (${e.title}) date ${e.date} is more than ~4 months out`);
}

// Summary
const tier1Events = events.filter((e) => TIER1_CITIES.has(e.city)).length;
console.log("─".repeat(52));
console.log(`Events: ${events.length}   Cities: ${citiesTotal}   Tier-1 events: ${tier1Events}`);
console.log(`States: ${statesCities.length}   Tier-1 metros: ${TIER1_CITIES.size}`);
console.log("─".repeat(52));
warnings.forEach((w) => console.log(`⚠ ${w}`));
errors.forEach((e) => console.log(`✗ ${e}`));
if (errors.length) {
  console.log(`FAILED: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`✅ All checks passed.`);
