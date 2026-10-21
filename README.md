# Eventra — Event Management & Ticketing Platform

A production-grade event management platform inspired by Eventbrite, Meetup, Townscript and Airmeet: event discovery, registration & payments, QR e-tickets, organizer analytics, AI-assisted recommendations, and a full attendee lifecycle — in one React + Express app.

## Feature map

### Discovery & events
- **Event catalog** with location-first browsing (state → city), seat availability, "selling fast" badges
- **Dedicated event pages** — banner, agenda/schedule, organizer profile, seat progress, share & save buttons
- **Smart search** — fuzzy matching, server suggestions, category/city/date-range filters
- **Google-Maps-style venue maps** (Leaflet + OpenStreetMap, no API key): embedded map, directions, distance, nearby landmarks
- **Recommended For You** — interest/history/location-based scoring with match reasons
- **Trending / popularity prediction** — High 🔥 / Medium ⚡ / Low 📉 labels, confidence scores, growth trends

### Tickets & check-in
- **QR e-tickets** issued at registration (`EVTR-XXXX-XXXX` codes with checksum)
- **Branded PDF download**, printable view, email-ticket flow
- **My Tickets** dashboard — upcoming/past tabs, payment history, waitlist status, search & filters
- **Organizer QR scanner** — camera scanning, duplicate-entry prevention, live attendance stats, manual code entry fallback

### Organizer tools
- **Analytics dashboard** — revenue, registrations, attendance, conversion, weekly growth & revenue charts (Recharts)
- **Attendee management** — search, status filters, CSV export, VIP/Regular ticket views
- **Announcements** — notify all attendees (optionally the waitlist)
- **Waitlist console** — FIFO queue with automatic promotion when seats free up (cancellation → instant promotion)

### Platform
- **Auth** — JWT signup/login, admin roles, protected routes
- **Payments** — Razorpay checkout flow with mock mode for development
- **Notification center** — server-persisted (registration, ticket, reminder, update, waitlist, payment), bell dropdown + full page
- **User profile** — editable info, interest chips feeding recommendations, saved events, tickets, activity history
- **Feedback & ratings** — star reviews on completed events with aggregate analytics

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts, Framer Motion |
| Backend | Node, Express 5, Sequelize (MySQL prod / SQLite tests), JWT, bcrypt |
| Tickets | qrcode, jsPDF, jsQR (camera scanning) |
| Maps | Leaflet + OpenStreetMap (keyless) |

## Getting started

```bash
npm install

# 1) Database — MySQL by default (see .env.example), or:
#    DB_DIALECT=sqlite DB_STORAGE=./dev.sqlite for a zero-setup start
# 2) Start both apps
npm run dev:all        # Vite on :3000 + API on :5001 (API_PORT to change)
```

The API boots idempotently: models sync, then `migrations/upgradePhase1.js` adds any missing columns/tables — no manual migration step needed after pulling.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run server` / `npm run dev:all` | Vite / API / both |
| `npm test` | Vitest unit tests (client) |
| `npm run test:server` | Node test runner — booking concurrency, ticket codes, check-in, waitlist, notifications, feedback |
| `npm run build` | Production build (code-split vendor chunks) |
| `npm run migrate:upgrade` | Run the phase-1 schema upgrade migration manually |
| `npm run seed` / `seed:reset` / `seed:refresh` | Sample data control (safe by default) |

## API surface (new in this upgrade)

```
/api/tickets            GET my tickets · GET :id · GET :id/qr · POST issue · POST checkin
                        GET /stats/:eventId · GET /attendees/:eventId
/api/waitlist           GET mine · POST join · DELETE :id · GET /event/:eventId · POST /promote/:eventId
/api/feedback           POST submit · GET /event/:id · GET /mine
/api/saved              GET · POST toggle · DELETE :eventId
/api/notifications      GET · GET /unread-count · POST /read-all · POST /:id/read · DELETE
/api/predictions        GET popularity predictions · GET /recommendations
                        GET /search · GET /search/suggestions
/api/organizer          GET /overview · POST /events · POST /events/:id/announce
/api/profile            GET · PUT (incl. interests) · PUT /password
```

All existing endpoints (auth, events, registrations, payments, stats, users) are unchanged and continue to work as before.

## Testing

- **Client** — `npm test` (Vitest + jsdom): location persistence, API query building
- **Server** — `npm run test:server`: 20-user concurrent booking (no oversell), ticket code generation/normalization, check-in duplicate prevention, FIFO waitlist promotion with auto-fill, notification persistence, one-review-per-user feedback constraint

## Deployment notes

- Set `JWT_SECRET`, `DB_*`, and `CORS_ORIGIN` in production (see `.env.example`)
- The React build (`dist/`) can be served by any static host; proxy `/api` to the Express server
- Camera QR scanning requires HTTPS (or localhost)
