/**
 * Seed CLI — entry point for the npm scripts:
 *   npm run seed          fill in any missing generated events (+ admin from .env)
 *   npm run seed:reset    DEVELOPMENT ONLY: wipe all events, reseed from scratch
 *   npm run seed:refresh  remove past-dated generated events, re-add upcoming ones
 */
import "./config/database.js"; // loads .env and connects
import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "./models/index.js";
import {
  seedSampleEvents,
  resetAndSeed,
  refreshPastEvents,
  ensureEventLocationColumns,
  ensureAdminUser,
} from "./seedLocations.js";

const mode = process.argv[2] || "";

async function main() {
  await sequelize.authenticate();
  console.log("✅ Database connected");

  await sequelize.sync({ alter: false });
  await ensureEventLocationColumns();

  if (mode === "--reset") {
    if (process.env.NODE_ENV === "production") {
      console.error("✋ seed:reset is disabled when NODE_ENV=production.");
      process.exitCode = 1;
      return;
    }
    await resetAndSeed();
  } else if (mode === "--refresh") {
    await refreshPastEvents();
  } else {
    await seedSampleEvents();
  }

  await ensureAdminUser();
  await sequelize.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
