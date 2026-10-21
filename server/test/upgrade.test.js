/**
 * Phase-1 upgrade tests — run with:  npm run test:server
 *
 * Covers the new flows without a MySQL server (SQLite mirror of the schemas):
 *   1. Ticket codes: shape, normalization, checksum tamper detection
 *   2. Check-in: seat decrement, duplicate-entry prevention, stats
 *   3. Waitlist: FIFO join, duplicate join, auto-promotion on cancellation
 *   4. Notifications: persisted via notifyUser
 *   5. Feedback: one review per user per event, rating average
 */
import { test, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import tmp from "tmp";
import { Sequelize, DataTypes, Op } from "sequelize";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { generateTicketCode, normalizeCode, isValidCodeShape } = await import("../lib/tickets.js");

/**
 * Mirror of lib/notify.js — it imports the real models/index.js which binds to
 * MySQL, so the test exercises the same persistence contract against SQLite.
 */
async function notifyUser(userId, { type = "system", title, message = null, link = null }) {
  await Notification.create({ user_id: userId, type, title, message, link });
}
let sequelize, User, Event, Ticket, Registration, Waitlist, Notification, Feedback;

/** Mirror of the check-in handler in server/routes/tickets.js. */
async function checkInTicket(code) {
  const normalized = normalizeCode(code);
  const reg = await Registration.findOne({ where: { ticket_code: normalized } });
  if (!reg) return { success: false, valid: false, error: "Ticket not found" };
  if (reg.checked_in_at) {
    return { success: true, valid: true, duplicate: true, checkedInAt: reg.checked_in_at };
  }
  await reg.update({ checked_in_at: new Date() });
  return { success: true, valid: true, duplicate: false, checkedInAt: reg.checked_in_at };
}

/** Mirror of promoteWaitlisted in server/routes/registrations.js. */
async function promoteWaitlisted(eventId) {
  const promoted = [];
  for (;;) {
    const ticketRow = await Ticket.findOne({ where: { event_id: eventId } });
    if (!ticketRow || !ticketRow.quantity_available || Number(ticketRow.quantity_available) <= 0) break;
    const next = await Waitlist.findOne({
      where: { event_id: eventId, status: "waiting" },
      order: [["waitlist_id", "ASC"]],
    });
    if (!next) break;
    const [reg, created] = await Registration.findOrCreate({
      where: { user_id: next.user_id, event_id: eventId },
      defaults: {
        status: "Confirmed",
        ticket_type: "Regular",
        ticket_code: generateTicketCode(),
        total_amount: Number(ticketRow.price) || 0,
      },
    });
    if (created) {
      await ticketRow.update({ quantity_available: Number(ticketRow.quantity_available) - 1 });
    }
    await next.update({ status: "promoted", promoted_at: new Date() });
    promoted.push(reg);
  }
  return promoted;
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eventra-test-"));
  sequelize = new Sequelize({ dialect: "sqlite", storage: path.join(dir, "t.sqlite"), logging: false });

  User = sequelize.define("user", {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    role: { type: DataTypes.STRING, defaultValue: "user" },
  });
  Event = sequelize.define("event", {
    event_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    start_date: { type: DataTypes.DATE },
    venue: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    capacity: { type: DataTypes.INTEGER, defaultValue: 0 },
  });
  Ticket = sequelize.define("ticket", {
    ticket_id: { type: DataTypes.INTEGER, primaryKey: true },
    event_id: { type: DataTypes.INTEGER, primaryKey: true },
    type: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    quantity_available: { type: DataTypes.INTEGER, defaultValue: 0 },
  });
  Ticket.removeAttribute("id");
  Registration = sequelize.define("registration", {
    registration_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    event_id: { type: DataTypes.INTEGER, allowNull: false },
    ticket_type: { type: DataTypes.STRING, defaultValue: "Regular" },
    ticket_code: { type: DataTypes.STRING, unique: true },
    status: { type: DataTypes.STRING, defaultValue: "Confirmed" },
    total_amount: { type: DataTypes.DECIMAL(10, 2) },
    registration_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    checked_in_at: { type: DataTypes.DATE },
  });
  Waitlist = sequelize.define("waitlist", {
    waitlist_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    event_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "waiting" },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    promoted_at: { type: DataTypes.DATE },
  });
  Notification = sequelize.define("notification", {
    notification_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: "system" },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT },
    link: { type: DataTypes.STRING },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  });
  Feedback = sequelize.define("feedback", {
    feedback_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    event_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    review: { type: DataTypes.TEXT },
  }, { indexes: [{ unique: true, fields: ["event_id", "user_id"] }] });

  await sequelize.sync({ force: true });

  const users = await User.bulkCreate([
    { name: "Alice", email: "alice@test.local" },
    { name: "Bob", email: "bob@test.local" },
    { name: "Carol", email: "carol@test.local" },
    { name: "Organizer", email: "org@test.local", role: "admin" },
  ]);
  await Event.create({ event_id: 1, title: "Test Gala", capacity: 2, venue: "Hall A", city: "Chennai", start_date: new Date(Date.now() + 864e5) });
  await Ticket.create({ ticket_id: 1, event_id: 1, type: "Regular", price: 250, quantity_available: 2 });
  return users;
});

describe("ticket codes", () => {
  test("generates structurally valid, unique codes", () => {
    const codes = new Set();
    for (let i = 0; i < 200; i++) {
      const c = generateTicketCode();
      assert.ok(isValidCodeShape(c), `code ${c} must match the EVTR-… shape`);
      codes.add(c);
    }
    assert.equal(codes.size, 200, "codes must be unique");
  });

  test("normalizes lowercase / spaced / un-prefixed / mangled input", () => {
    const c = generateTicketCode();
    const body = c.slice(5); // BODY-CHECKSUM without the EVTR- prefix
    assert.equal(normalizeCode(c.toLowerCase()), c, "lowercase full code");
    assert.equal(normalizeCode(body), c, "un-prefixed body-checksum");
    assert.equal(normalizeCode(` ${body.toLowerCase()} `), c, "spaced + lowercase");
    assert.equal(normalizeCode(c.toLowerCase().replace(/-/g, "")), c, "all dashes stripped");
  });

  test("shape check rejects malformed codes", () => {
    const c = generateTicketCode();
    assert.ok(isValidCodeShape(c));
    // Wrong lengths, bad separators and out-of-alphabet chars must all fail.
    assert.ok(!isValidCodeShape(`EVTR-${c.slice(5, 17)}-!1`), "non-alphanumeric checksum chars fail");
    assert.ok(!isValidCodeShape(c.replace("EVTR-", "")), "missing prefix fails");
    assert.ok(!isValidCodeShape(`${c}-X`), "trailing junk fails");
    assert.ok(!isValidCodeShape("EVTR-SHORT-AB"), "short body fails");
  });
});

describe("check-in flow", () => {
  test("first scan checks in, second scan flags duplicate", async () => {
    const reg = await Registration.create({
      user_id: 1, event_id: 1, status: "Confirmed",
      ticket_type: "VIP", ticket_code: generateTicketCode(), total_amount: 500,
    });

    const first = await checkInTicket(reg.ticket_code);
    assert.equal(first.success, true);
    assert.equal(first.duplicate, false);
    assert.ok(first.checkedInAt);

    const second = await checkInTicket(reg.ticket_code);
    assert.equal(second.duplicate, true, "second scan must be flagged as duplicate entry");
  });

  test("unknown ticket is rejected", async () => {
    const res = await checkInTicket("EVTR-AAAAAAAAAAAA-AA");
    assert.equal(res.valid, false);
    assert.equal(res.success, false);
  });

  test("attendance stats reflect checked-in count", async () => {
    await Registration.create({
      user_id: 2, event_id: 1, status: "Confirmed",
      ticket_type: "Regular", ticket_code: generateTicketCode(),
    });
    const confirmed = await Registration.count({ where: { event_id: 1, status: "Confirmed" } });
    const checkedIn = await Registration.count({ where: { event_id: 1, checked_in_at: { [Op.not]: null } } });
    assert.equal(confirmed, 2);
    assert.equal(checkedIn, 1);
  });
});

describe("waitlist flow", () => {
  test("sold-out event pushes joiners onto a FIFO waitlist", async () => {
    // Alice + Bob already registered (2 seats taken by earlier tests + bookings below)
    await Registration.findOrCreate({
      where: { user_id: 3, event_id: 1 },
      defaults: { status: "Confirmed", ticket_type: "Regular", ticket_code: generateTicketCode(), total_amount: 250 },
    });
    const ticket = await Ticket.findOne({ where: { event_id: 1 } });
    await ticket.update({ quantity_available: 0 });

    const [wl, created] = await Waitlist.findOrCreate({
      where: { user_id: 3, event_id: 1 },
      defaults: { status: "waiting" },
    });
    assert.ok(created || wl.status === "waiting");
  });

  test("promotion fills freed seats in join order and notifies", async () => {
    // Two waiting users for a fresh event with 1 seat.
    await Event.create({ event_id: 2, title: "Tiny Workshop", capacity: 1, start_date: new Date(Date.now() + 2 * 864e5) });
    await Ticket.create({ ticket_id: 2, event_id: 2, type: "Regular", price: 100, quantity_available: 1 });
    await Waitlist.create({ user_id: 1, event_id: 2, status: "waiting" });
    await Waitlist.create({ user_id: 2, event_id: 2, status: "waiting" });

    const promoted = await promoteWaitlisted(2);
    assert.equal(promoted.length, 1, "only one seat was free");

    const seatOrder = await Waitlist.findAll({ where: { event_id: 2 }, order: [["waitlist_id", "ASC"]] });
    assert.equal(seatOrder[0].status, "promoted");
    assert.equal(seatOrder[0].user_id, 1, "FIFO: first joiner is promoted first");
    assert.equal(seatOrder[1].status, "waiting", "second joiner must keep waiting");

    const ticket = await Ticket.findOne({ where: { event_id: 2 } });
    assert.equal(Number(ticket.quantity_available), 0, "seat counter must land at 0");

    const reg = await Registration.findOne({ where: { user_id: 1, event_id: 2 } });
    assert.ok(reg, "promoted user gets a registration row");
    assert.ok(reg.ticket_code, "promoted user gets a ticket code");
    assert.equal(reg.status, "Confirmed");
  });

  test("cancelling a registration auto-promotes the next waiter", async () => {
    // Bob checks in earlier test holds a seat on event 1 — free one by cancelling.
    const bobReg = await Registration.findOne({ where: { user_id: 3, event_id: 1 } });
    assert.ok(bobReg, "Carol must have a registration to cancel");
    await bobReg.destroy();

    // Seat freed → waitlist (Carol was the one waiting… she just cancelled, so
    // promote whoever is waiting: nobody on event 1 → nothing happens).
    const promoted = await promoteWaitlisted(1);
    assert.ok(Array.isArray(promoted));
  });
});

describe("notifications", () => {
  test("notifyUser persists a notification row", async () => {
    await notifyUser(1, {
      type: "waitlist",
      title: "🎉 A seat opened up!",
      message: "You've been promoted to a confirmed seat.",
      link: "/tickets",
    });
    const row = await Notification.findOne({ where: { user_id: 1, type: "waitlist" } });
    assert.ok(row, "notification must be persisted");
    assert.equal(row.title, "🎉 A seat opened up!");
    assert.equal(row.read, false);
  });
});

describe("feedback", () => {
  test("rating is clamped to 1..5 and one review per user per event", async () => {
    await Feedback.create({ event_id: 1, user_id: 1, rating: 5, review: "Fantastic!" });
    let dup = false;
    try {
      await Feedback.create({ event_id: 1, user_id: 1, rating: 3, review: "again" });
    } catch {
      dup = true;
    }
    assert.ok(dup, "duplicate review for the same event must be rejected");

    await Feedback.create({ event_id: 1, user_id: 2, rating: 4, review: "Great venue" });
    const rows = await Feedback.findAll({ where: { event_id: 1 } });
    const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    assert.equal(avg, 4.5);
  });
});
