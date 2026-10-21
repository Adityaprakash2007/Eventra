/**
 * Idempotent upgrade migration — safe to run any number of times.
 *
 * Adds the new columns and tables introduced by the production upgrade
 * (banner/agenda/map fields on event; attendance on registration; profile
 * fields on user; waitlist/feedback/saved_event/notification/agenda_item
 * tables). Existing rows and data are never touched.
 *
 * Run:  npm run migrate:upgrade
 */
import sequelize from "../config/database.js";
import { DataTypes } from "sequelize";

async function columnExists(qi, table, column) {
  const cols = await qi.describeTable(table).catch(() => null);
  return !!cols && !!cols[column];
}

async function addColumnIfMissing(qi, table, column, definition) {
  if (await columnExists(qi, table, column)) return false;
  await qi.addColumn(table, column, definition);
  console.log(`  ✚ ${table}.${column}`);
  return true;
}

async function tableExists(qi, table) {
  const cols = await qi.describeTable(table).catch(() => null);
  return !!cols;
}

export async function runUpgradeMigration() {
  const qi = sequelize.getQueryInterface();
  let touched = 0;

  console.log("→ Running upgrade migration…");

  // ── event table: banner image, agenda text, venue map coords, organizer ──
  if (await tableExists(qi, "event")) {
    touched += (await addColumnIfMissing(qi, "event", "image", { type: DataTypes.STRING(500), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "event", "agenda", { type: DataTypes.TEXT, allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "event", "venue_lat", { type: DataTypes.DECIMAL(10, 7), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "event", "venue_lng", { type: DataTypes.DECIMAL(10, 7), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "event", "organizer_name", { type: DataTypes.STRING(255), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "event", "organizer_bio", { type: DataTypes.TEXT, allowNull: true })) ? 1 : 0;
  }

  // ── registration table: QR ticket + attendance ──
  if (await tableExists(qi, "registration")) {
    touched += (await addColumnIfMissing(qi, "registration", "ticket_code", { type: DataTypes.STRING(64), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "registration", "ticket_type", { type: DataTypes.STRING(20), allowNull: true, defaultValue: "Regular" })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "registration", "checked_in_at", { type: DataTypes.DATE, allowNull: true })) ? 1 : 0;
  }

  // ── user table: profile fields ──
  if (await tableExists(qi, "user")) {
    touched += (await addColumnIfMissing(qi, "user", "phone", { type: DataTypes.STRING(30), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "user", "bio", { type: DataTypes.TEXT, allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "user", "avatar_color", { type: DataTypes.STRING(20), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "user", "interests", { type: DataTypes.TEXT, allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "user", "state", { type: DataTypes.STRING(100), allowNull: true })) ? 1 : 0;
    touched += (await addColumnIfMissing(qi, "user", "city", { type: DataTypes.STRING(100), allowNull: true })) ? 1 : 0;
  }

  // ── new tables (create only when missing; never drops data) ──
  const newTables = [
    ["feedback", {
      feedback_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      event_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
      review: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    }],
    ["waitlist", {
      waitlist_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      event_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "waiting" },
      joined_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
      promoted_at: { type: DataTypes.DATE, allowNull: true },
    }],
    ["saved_event", {
      saved_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      event_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    }],
    ["notification", {
      notification_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "system" },
      title: { type: DataTypes.STRING(255), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: true },
      link: { type: DataTypes.STRING(255), allowNull: true },
      read_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    }],
    ["agenda_item", {
      agenda_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      event_id: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      start_time: { type: DataTypes.TIME, allowNull: true },
      end_time: { type: DataTypes.TIME, allowNull: true },
      speaker: { type: DataTypes.STRING(255), allowNull: true },
      item_order: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    }],
  ];

  for (const [table, attrs] of newTables) {
    if (!(await tableExists(qi, table))) {
      const Model = sequelize.define(table, attrs, { freezeTableName: true, timestamps: false });
      await Model.sync();
      console.log(`  ✚ table ${table}`);
      touched++;
    }
  }

  // Unique indexes for one-per-user constraints (best-effort; MySQL errors if they exist)
  try {
    await sequelize.query("ALTER TABLE feedback ADD UNIQUE INDEX feedback_event_user_uq (event_id, user_id)");
    touched++;
  } catch { /* already exists */ }
  try {
    await sequelize.query("ALTER TABLE waitlist ADD UNIQUE INDEX waitlist_event_user_uq (event_id, user_id)");
    touched++;
  } catch { /* already exists */ }
  try {
    await sequelize.query("ALTER TABLE saved_event ADD UNIQUE INDEX saved_event_event_user_uq (event_id, user_id)");
    touched++;
  } catch { /* already exists */ }

  console.log(touched > 0 ? `✅ Migration complete (${touched} changes)` : "✅ Migration complete (already up to date)");
}

// Run directly: node server/migrations/upgradePhase1.js
if (import.meta.url === `file://${process.argv[1]}`) {
  sequelize.authenticate()
    .then(runUpgradeMigration)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Migration failed:", err.message);
      process.exit(1);
    });
}
