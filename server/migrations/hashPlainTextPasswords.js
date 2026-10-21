/**
 * One-time migration: bcrypt-hash any plain-text passwords in the users table.
 *
 * Run once after installing dependencies:
 *   npm run migrate:hash-passwords
 *
 * Idempotent — rows whose password already looks like a bcrypt hash
 * (starts with $2a/$2b/$2y) are left untouched.
 */
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { sequelize, User } from "../models/index.js";

function isHashed(pw) {
  return typeof pw === "string" && /^\$2[aby]\$/.test(pw);
}

async function main() {
  await sequelize.authenticate();
  const users = await User.findAll();
  let fixed = 0;
  let alreadyOk = 0;

  for (const user of users) {
    if (isHashed(user.password)) {
      alreadyOk++;
      continue;
    }
    await user.update({ password: await bcrypt.hash(user.password, 10) });
    fixed++;
    console.log(`  🔒 hashed password for ${user.email}`);
  }

  console.log(
    `✅ Password migration complete: ${fixed} hashed, ${alreadyOk} already secure, ${users.length} total users.`
  );
  await sequelize.close();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
