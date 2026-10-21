/**
 * Booking concurrency test — run with:  npm run test:server
 *
 * Fires 20 simultaneous registrations at an event with only 3 seats and
 * asserts that EXACTLY 3 succeed (the row-locked transaction prevents
 * overselling), each user gets at most one seat, and quantity_available
 * lands at 0 — never negative.
 *
 * Uses SQLite (file-backed) so it runs without a MySQL server. SQLite has no
 * SELECT ... FOR UPDATE; BEGIN IMMEDIATE serializes writers, and the busy-wait
 * wrapper below emulates the BLOCKING behaviour an InnoDB row lock gives you
 * on MySQL — losing callers wait for the winner to commit instead of failing.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import tmp from "tmp";
import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const { toPublicUser } = await import("../middleware/auth.js");

let sequelize, User, Event, Ticket, Registration;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isBusyError(err) {
  const text = `${err?.message || ""} ${err?.original?.message || ""}`;
  return /SQLITE_BUSY|database is locked/i.test(text);
}

/**
 * Minimal re-implementation of the booking transaction (same lock, order and
 * updates as server/routes/registrations.js). If you change one, change both.
 */
async function bookSeat(userId, eventId) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await sequelize.transaction(
        { type: Sequelize.Transaction.TYPES.IMMEDIATE },
        async (t) => {
          // Lock the ticket row (SELECT ... FOR UPDATE on MySQL) until commit.
          const ticketRow = await Ticket.findOne({
            where: { event_id: eventId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!ticketRow) {
            throw Object.assign(new Error("This event has no bookable ticket yet"), { statusCode: 409 });
          }
          if (!ticketRow.quantity_available || ticketRow.quantity_available <= 0) {
            throw Object.assign(new Error("Sold out — no seats left for this event"), { statusCode: 409 });
          }

          const [reg, created] = await Registration.findOrCreate({
            where: { user_id: userId, event_id: eventId },
            defaults: { status: "Confirmed" },
            transaction: t,
          });
          if (!created) {
            throw Object.assign(new Error("You have already registered for this event"), {
              statusCode: 409,
            });
          }

          const newAvailable = Number(ticketRow.quantity_available) - 1; // guarded above: never < 0
          await ticketRow.update({ quantity_available: newAvailable }, { transaction: t });
          await reg.update({ total_amount: Number(ticketRow.price) }, { transaction: t });
          return reg;
        }
      );
    } catch (err) {
      // Emulate InnoDB blocking: wait briefly and retry on a busy database.
      if (isBusyError(err) && attempt <= 40) {
        await sleep(20 + Math.random() * 40);
        continue;
      }
      throw err;
    }
  }
}

before(async () => {
  const dbFile = tmp.fileSync({ postfix: ".sqlite" }).name;
  sequelize = new Sequelize({ dialect: "sqlite", storage: dbFile, logging: false });

  User = sequelize.define("user", {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
  });
  Event = sequelize.define("event", {
    event_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
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
    status: { type: DataTypes.STRING },
    total_amount: { type: DataTypes.DECIMAL(10, 2) },
  });

  await sequelize.sync({ force: true });

  // 20 users race for 3 seats on one event
  await User.bulkCreate(
    Array.from({ length: 20 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@test.local`,
      password: bcrypt.hashSync("password123", 10),
      role: "user",
    }))
  );
  await Event.create({ event_id: 1, title: "Tiny Venue Night", capacity: 3 });
  await Ticket.create({
    ticket_id: 1,
    event_id: 1,
    type: "Regular",
    price: 100,
    quantity_available: 3,
  });
});

test("concurrent bookings never oversell a 3-seat event", async () => {
  const users = await User.findAll({ order: [["user_id", "ASC"]] });

  // Fire all 20 at once, unawaited — true simultaneity.
  const attempts = users.map((u) =>
    bookSeat(u.user_id, 1).then(
      (reg) => ({ ok: true, reg }),
      (err) => ({ ok: false, code: err.statusCode })
    )
  );
  const results = await Promise.all(attempts);

  const confirmed = results.filter((r) => r.ok);
  const rejected = results.filter((r) => !r.ok);

  assert.equal(confirmed.length, 3, `expected exactly 3 confirmed, got ${confirmed.length}`);
  assert.equal(rejected.length, 17, `expected 17 rejected, got ${rejected.length}`);
  assert.ok(
    rejected.every((r) => r.code === 409),
    "every rejection must be the friendly 409 (sold out / duplicate)"
  );

  // Seat counter landed exactly at zero, never negative
  const ticket = await Ticket.findOne({ where: { event_id: 1 } });
  assert.equal(Number(ticket.quantity_available), 0, "quantity_available must end at 0");

  // Exactly 3 registration rows exist for the event, one per distinct user
  const regs = await Registration.findAll({ where: { event_id: 1 } });
  assert.equal(regs.length, 3, "exactly 3 registration rows must exist");
  assert.equal(new Set(regs.map((r) => r.user_id)).size, 3, "one seat per distinct user");
});

test("toPublicUser never leaks the password hash", async () => {
  const user = await User.findOne({ where: { email: "user1@test.local" } });
  assert.ok(user.password.startsWith("$2"), "stored password must be bcrypt-hashed");

  const publicShape = toPublicUser(user);
  assert.equal(publicShape.password, undefined, "public shape must have no password field");
  assert.ok(
    !JSON.stringify(publicShape).includes(user.password),
    "hash must not appear anywhere in the public payload"
  );
  assert.ok(
    typeof publicShape.token === "string" && publicShape.token.split(".").length === 3,
    "public shape must carry a signed JWT"
  );
});
