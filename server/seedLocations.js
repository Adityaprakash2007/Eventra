/**
 * Seeding utilities for the Eventra backend.
 *
 * Safety rules:
 *  - Boot-time seeding only runs when the events table is EMPTY
 *    (see server/index.js) — rows created by real users are never touched.
 *  - `npm run seed` (seedCli.js) fills in any missing generated events.
 *  - `npm run seed:reset` wipes ALL events and reseeds (development only).
 *  - `npm run seed:refresh` removes past-dated generated events and re-adds
 *    upcoming ones, so the demo data never goes stale.
 *
 * The dataset itself lives in public/data/events.json and is produced by
 * scripts/generateEvents.cjs (fixed seed → identical shape every run).
 */
import { Event, Ticket, User, sequelize } from "./models/index.js";
import { DataTypes, Op } from "sequelize";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_JSON = path.join(__dirname, "..", "public", "data", "events.json");

function loadDataset() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_JSON, "utf8"));
  } catch (err) {
    console.warn(
      `⚠ ${path.basename(EVENTS_JSON)} missing/invalid (${err.message}) — ` +
        `run \`npm run events:generate\` first.`
    );
    return [];
  }
}

/** "4:00 PM" → "16:00:00" (MySQL-safe 24h time). */
function toTime24(timeStr) {
  const m = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i.exec(String(timeStr || "").trim());
  if (!m) return "18:00:00";
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}:00`;
}

/** Map a generated event onto the Event model's column names. */
function mapRow(e) {
  const t = toTime24(e.time);
  return {
    title: e.title,
    venue: e.venue,
    state: e.state,
    city: e.city,
    description: e.description,
    category: e.category,
    capacity: e.totalSeats,
    status: "Open",
    organizer_id: 1,
    start_date: new Date(`${e.date}T${t}`),
    end_date: new Date(`${e.date}T${t}`),
  };
}

async function upsertGeneratedEvents(rows) {
  let created = 0;
  let skipped = 0;
  for (const e of rows) {
    const [event, wasCreated] = await Event.findOrCreate({
      where: { title: e.title },
      defaults: { ...mapRow(e), event_id: e.id },
    });

    if (wasCreated) created++;
    else skipped++;

    // Backfill state/city on rows created before this feature existed
    if (!wasCreated && (!event.state || !event.city)) {
      await event.update({ state: e.state, city: e.city });
    }

    // Give each event one Regular ticket so pricing/seat-locking works
    const ticketCount = await Ticket.count({ where: { event_id: event.event_id } });
    if (ticketCount === 0) {
      await Ticket.create({
        ticket_id: 1, // composite PK (ticket_id, event_id) — one Regular ticket per event
        event_id: event.event_id,
        type: "Regular",
        price: e.price,
        quantity_available: e.seats,
      });
    }
  }

  // Keep AUTO_INCREMENT past the imported ids so new admin events don't clash.
  const maxId = rows.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
  if (maxId > 0) {
    await sequelize.query(`ALTER TABLE \`event\` AUTO_INCREMENT = ${maxId + 1}`).catch(() => {});
  }
  return { created, skipped, total: rows.length };
}

/**
 * Seeds generated events ONLY when the events table is empty. Called on boot
 * (gated behind SEED_ON_BOOT=1) so a populated database is never modified.
 */
export async function seedIfEmpty() {
  const count = await Event.count();
  if (count > 0) {
    console.log(`ℹ Events table has ${count} rows — skipping boot seed (use \`npm run seed\` to top up).`);
    return;
  }
  const rows = loadDataset();
  if (!rows.length) return;
  const { created } = await upsertGeneratedEvents(rows);
  console.log(`✅ Empty table seeded with ${created} generated events`);
}

/** `npm run seed` — create any generated events that are missing. */
export async function seedSampleEvents() {
  const rows = loadDataset();
  if (!rows.length) return;
  const { created, skipped, total } = await upsertGeneratedEvents(rows);
  console.log(`✅ Event seed ensured ${total} generated events exist (${created} created, ${skipped} already present)`);
}

/** `npm run seed:reset` — development only: wipe all events and reseed. */
export async function resetAndSeed() {
  await Ticket.destroy({ where: {} });
  await Event.destroy({ where: {} });
  try {
    await sequelize.query("ALTER TABLE `event` AUTO_INCREMENT = 1");
  } catch {
    /* SQLite/tests */
  }
  console.log("♻ Wiped all events and tickets");
  await seedSampleEvents();
}

/** `npm run seed:refresh` — drop past-dated generated events, re-add upcoming. */
export async function refreshPastEvents() {
  const rows = loadDataset();
  if (!rows.length) return;
  const generatedTitles = rows.map((r) => r.title);

  const deleted = await Event.destroy({
    where: { start_date: { [Op.lt]: new Date() }, title: { [Op.in]: generatedTitles } },
  });
  console.log(`🧹 Removed ${deleted} past-dated generated events`);
  await seedSampleEvents();
}

/**
 * Seeded admin account, credentials read from .env (never hardcoded).
 * Created only if no admin exists yet; skipped with guidance if .env lacks a password.
 */
export async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.warn(
      "⚠ ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — seeded admin account skipped.\n" +
        "  Set them, then run `npm run seed` to create the admin."
    );
    return;
  }

  const existingAdmin = await User.findOne({ where: { role: "admin" } });
  if (existingAdmin) {
    console.log(`ℹ Admin account already exists (${existingAdmin.email}) — not modifying it.`);
    return;
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    await existingEmail.update({ role: "admin" });
    console.log(`✅ Promoted existing user ${email} to admin`);
    return;
  }

  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role: "admin",
  });
  console.log(`✅ Seeded admin account: ${email}`);
}

/**
 * Adds state/city columns to the event table when missing (safe no-op on
 * MySQL 8 / MariaDB where IF NOT EXISTS is supported).
 */
export async function ensureEventLocationColumns() {
  const qi = sequelize.getQueryInterface();
  const table = "event";
  const columns = await qi.describeTable(table).catch(() => null);
  if (!columns) return; // table doesn't exist yet — sequelize.sync() creates it

  for (const col of ["state", "city"]) {
    if (!columns[col]) {
      await qi.addColumn(table, col, {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      console.log(`✅ Added column event.${col}`);
    }
  }
}
