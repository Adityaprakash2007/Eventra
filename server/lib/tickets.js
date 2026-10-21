import crypto from "crypto";

/**
 * Ticket helpers shared by booking, check-in and QR endpoints.
 *
 * Ticket code format: EVTR-<base32 token>-<checksum>
 *  - 12 chars of Crockford-style base32 randomness (~60 bits)
 *  - 2-char checksum so a typo'd code fails fast without a DB hit
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U (confusable)

function checksumOf(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum = (sum * 31 + ALPHABET.indexOf(body[i])) % 997;
  return ALPHABET[sum % 32] + ALPHABET[Math.floor(sum / 32) % 32];
}

/** Generate a fresh unique ticket code. */
export function generateTicketCode() {
  // One byte per character — 12 bytes for the 12-char body.
  const bytes = crypto.randomBytes(12);
  let body = "";
  for (let i = 0; i < 12; i++) {
    body += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `EVTR-${body}-${checksumOf(body)}`;
}

/**
 * Normalize user input for lookup (uppercase, strip spaces).
 * Accepts the full code, the body-checksum form without the EVTR- prefix,
 * or a dash/space-mangled variant — always returns the canonical shape.
 */
export function normalizeCode(input) {
  const raw = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  // Accept "EVTR-…", "EVTR…" (dash stripped by the user) and bare codes alike.
  const stripped = raw.startsWith("EVTR") ? raw.slice(4).replace(/-/g, "") : raw.replace(/-/g, "");
  // 14 chars = 12-char body + 2-char checksum → re-dash canonically.
  if (stripped.length >= 14) return `EVTR-${stripped.slice(0, 12)}-${stripped.slice(12, 14)}`;
  return `EVTR-${stripped}`;
}

/** Quick structural check (full validation happens against the DB). */
export function isValidCodeShape(code) {
  return /^EVTR-[0-9A-Z]{12}-[0-9A-Z]{2}$/.test(String(code || ""));
}
