import { Router } from "express";
import { Event, Registration, Ticket, User, Feedback, SavedEvent } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { Op, fn, col, literal } from "sequelize";

const router = Router();

/* ══════════════════════════════════════════════════════════════
 * Phase 2 — Event Popularity Prediction
 *
 * A transparent, feature-based scoring model ("ML-inspired", fully
 * explainable — great for demos). For every upcoming event we compute:
 *
 *   demandScore   — registrations so far ÷ days on sale (velocity)
 *   fillScore     — registration share of capacity
 *   buzzScore     — saves + feedback warmth from the organizer's past events
 *   timingScore   — weekend evenings score higher; far-future events dip
 *   categoryScore — global demand for this category (registrations per event)
 *
 * popularity = weighted blend → 0–100 with a confidence band based on how
 * much historical signal exists. Trend = 7-day registration delta.
 * ══════════════════════════════════════════════════════════════ */

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function categoryLabel(score) {
  if (score >= 70) return { label: "High", emoji: "🔥", color: "high" };
  if (score >= 40) return { label: "Medium", emoji: "⚡", color: "medium" };
  return { label: "Low", emoji: "📉", color: "low" };
}

// GET /api/predictions — scored list of upcoming events
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const events = await Event.findAll({
      where: { start_date: { [Op.gte]: now } },
      include: [
        { model: Ticket, as: "tickets", attributes: ["price", "quantity_available"] },
        { model: Registration, as: "registrations", attributes: ["registration_id", "registration_date", "status", "user_id"] },
      ],
    });

    // Category-level global demand (registrations per category across ALL events)
    const catDemand = await Registration.findAll({
      attributes: ["event_id", [fn("COUNT", col("registration.registration_id")), "cnt"]],
      include: [{ model: Event, as: "event", attributes: ["category"] }],
      group: ["event.event_id"],
      raw: true,
      nest: true,
    });
    const catCounts = {};
    for (const row of catDemand) {
      const c = row.event?.category || "General";
      catCounts[c] = (catCounts[c] || 0) + Number(row.cnt);
    }
    const maxCat = Math.max(1, ...Object.values(catCounts));

    const scored = events.map((e) => {
      const plain = e.get({ plain: true });
      const regs = (plain.registrations || []).filter((r) => (r.status || "").toLowerCase() === "confirmed");
      const capacity = plain.capacity || 0;
      const remaining = plain.tickets?.[0] ? Number(plain.tickets[0].quantity_available) : capacity;
      const taken = Number.isFinite(remaining) && capacity ? Math.max(0, capacity - remaining) : regs.length;

      const start = new Date(plain.start_date);
      const daysToEvent = Math.max(1, Math.round((start - now) / DAY_MS));
      const ageDays = Math.max(1, Math.round((now - new Date(plain.created_at || plain.start_date)) / DAY_MS));

      // demand: registrations/day since listing (velocity), scaled by 1/day
      const demand = clamp((taken / ageDays) * 12, 0, 45);
      // fill: how full the event already is (closer to full → hotter)
      const fill = capacity > 0 ? clamp((taken / capacity) * 40, 0, 40) : clamp(regs.length * 4, 0, 40);
      // timing: weekend evening boost, urgency as the date approaches
      const isWeekend = [0, 5, 6].includes(start.getDay());
      const evening = start.getHours() >= 17;
      const timing = clamp((isWeekend ? 8 : 3) + (evening ? 4 : 0) + clamp((90 - daysToEvent) / 90, 0, 1) * 8, 0, 15);

      const catScore = clamp(((catCounts[plain.category] || 0) / maxCat) * 12, 0, 12);

      const popularity = Math.round(clamp(demand + fill + timing + catScore, 0, 100));
      const expectedAttendance = Math.round(taken + (capacity - taken) * clamp(popularity / 140, 0.05, 0.85));

      // trend: last-7-day registrations vs the 7 before that
      const sevenAgo = now.getTime() - 7 * DAY_MS;
      const fourteenAgo = now.getTime() - 14 * DAY_MS;
      const last7 = regs.filter((r) => new Date(r.registration_date || 0).getTime() >= sevenAgo).length;
      const prev7 = regs.filter((r) => {
        const t = new Date(r.registration_date || 0).getTime();
        return t >= fourteenAgo && t < sevenAgo;
      }).length;
      const trendPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0;

      // confidence grows with observed data volume
      const dataPoints = taken + (capacity > 0 ? 2 : 0);
      const confidence = Math.round(clamp(40 + Math.log2(1 + dataPoints) * 9, 40, 96));

      return {
        eventId: plain.event_id,
        title: plain.title,
        category: plain.category,
        city: plain.city,
        startDate: plain.start_date,
        capacity,
        registered: taken,
        popularity,
        confidence,
        expectedAttendance,
        trendPct,
        trend: trendPct > 5 ? "up" : trendPct < -5 ? "down" : "flat",
        ...categoryLabel(popularity),
        signals: { demand: Math.round(demand), fill: Math.round(fill), timing: Math.round(timing), category: Math.round(catScore) },
      };
    });

    scored.sort((a, b) => b.popularity - a.popularity);
    res.json({ generatedAt: new Date().toISOString(), predictions: scored });
  })
);

/* ══════════════════════════════════════════════════════════════
 * Phase 2 — Smart Recommendations ("Recommended For You")
 *
 * Score = category affinity (from interests + registration history)
 *       + location proximity (same city ≫ same state)
 *       + collaborative signal (events attended by users who attend
 *         the same events as you — "similar attendees")
 *       + freshness & availability
 * ══════════════════════════════════════════════════════════════ */

// GET /api/predictions/recommendations — personalized for the signed-in user
router.get(
  "/recommendations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const now = new Date();

    const [myRegs, me, mySaves] = await Promise.all([
      Registration.findAll({ where: { user_id: userId }, attributes: ["event_id"] }),
      User.findByPk(userId),
      SavedEvent.findAll({ where: { user_id: userId }, attributes: ["event_id"] }),
    ]);

    const myEventIds = new Set(myRegs.map((r) => r.event_id));
    const savedIds = new Set(mySaves.map((s) => s.event_id));

    // Category affinity: declared interests + registration history
    const interestWeights = {};
    String(me?.interests || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .forEach((c) => (interestWeights[c] = (interestWeights[c] || 0) + 3));

    const myCategories = await Registration.findAll({
      where: { user_id: userId },
      include: [{ model: Event, as: "event", attributes: ["category", "city", "state"] }],
    });
    for (const r of myCategories) {
      const c = (r.event?.category || "General").toLowerCase();
      interestWeights[c] = (interestWeights[c] || 0) + 2;
      if (r.event?.city) interestWeights[`@city:${r.event.city.toLowerCase()}`] = (interestWeights[`@city:${r.event.city.toLowerCase()}`] || 0) + 1;
    }

    // Collaborative signal: users who registered for the same events as me
    const peers = await Registration.findAll({
      where: { event_id: { [Op.in]: [...myEventIds] }, user_id: { [Op.ne]: userId } },
      attributes: ["user_id"],
      group: ["user_id"],
      raw: true,
    });
    const peerIds = peers.map((p) => p.user_id).slice(0, 200);

    let peerEventCounts = [];
    if (peerIds.length) {
      peerEventCounts = await Registration.findAll({
        where: { user_id: { [Op.in]: peerIds }, event_id: { [Op.notIn]: [...myEventIds] } },
        attributes: ["event_id", [fn("COUNT", col("registration.registration_id")), "cnt"]],
        group: ["event_id"],
        order: [[literal("cnt"), "DESC"]],
        limit: 50,
        raw: true,
      });
    }
    const peerScoreByEvent = {};
    for (const row of peerEventCounts) peerScoreByEvent[row.event_id] = Number(row.cnt);

    // Candidate pool: upcoming events I'm not registered for
    const candidates = await Event.findAll({
      where: { start_date: { [Op.gte]: now }, event_id: { [Op.notIn]: [...myEventIds] } },
      include: [{ model: Ticket, as: "tickets", attributes: ["price", "quantity_available"] }],
      limit: 120,
    });

    const reasonsMap = {};
    const scored = candidates
      .map((e) => {
        const plain = e.get({ plain: true });
        const cat = (plain.category || "General").toLowerCase();
        let score = 0;
        const reasons = [];

        if (interestWeights[cat]) {
          score += Math.min(30, interestWeights[cat] * 6);
          reasons.push(`matches your interest in ${plain.category}`);
        }
        if (me?.city && plain.city && me.city.toLowerCase() === plain.city.toLowerCase()) {
          score += 25;
          reasons.push(`happening in ${plain.city}`);
        } else if (me?.state && plain.state && me.state.toLowerCase() === plain.state.toLowerCase()) {
          score += 10;
          reasons.push(`in your state`);
        }
        if (peerScoreByEvent[plain.event_id]) {
          score += Math.min(20, peerScoreByEvent[plain.event_id] * 4);
          reasons.push("popular with attendees like you");
        }
        if (savedIds.has(plain.event_id)) {
          score += 8;
          reasons.push("you saved this event");
        }
        const daysToEvent = Math.round((new Date(plain.start_date) - now) / DAY_MS);
        if (daysToEvent <= 14) {
          score += 6;
          reasons.push("coming up soon");
        }
        score += Math.random() * 2; // tiny exploration jitter

        reasonsMap[plain.event_id] = reasons.slice(0, 3);
        return {
          eventId: plain.event_id,
          title: plain.title,
          category: plain.category,
          city: plain.city,
          venue: plain.venue,
          date: plain.start_date,
          price: plain.tickets?.[0] ? Number(plain.tickets[0].price) : 0,
          seats: plain.tickets?.[0] ? Number(plain.tickets[0].quantity_available) : plain.capacity || 0,
          score: Math.round(score * 10) / 10,
          reasons: reasonsMap[plain.event_id],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    res.json({ recommendations: scored, basedOn: Object.keys(interestWeights).length > 0 });
  })
);

/* ══════════════════════════════════════════════════════════════
 * Phase 2 — Smart Search
 * Fuzzy (trigram-ish similarity), category, location and date
 * filters + type-ahead suggestions.
 * ══════════════════════════════════════════════════════════════ */

function trigramSimilarity(a, b) {
  const gram = (s) => {
    const set = new Set();
    const pad = `  ${s.toLowerCase()}  `;
    for (let i = 0; i < pad.length - 2; i++) set.add(pad.slice(i, i + 3));
    return set;
  };
  const A = gram(a), B = gram(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / Math.min(A.size, B.size);
}

// GET /api/predictions/search?q=&category=&city=&state=&from=&to=&sort=
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const city = String(req.query.city || "").trim();
    const state = String(req.query.state || "").trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const sort = String(req.query.sort || "relevance");

    const where = {};
    if (category) where.category = { [Op.like]: category };
    if (city) where.city = { [Op.like]: city };
    if (state) where.state = { [Op.like]: state };
    if (from || to) {
      where.start_date = {};
      if (from && !isNaN(from)) where.start_date[Op.gte] = from;
      if (to && !isNaN(to)) where.start_date[Op.lte] = to;
    }

    const events = await Event.findAll({
      where,
      include: [{ model: Ticket, as: "tickets", attributes: ["price", "quantity_available"] }],
      limit: 300,
    });

    let results = events.map((e) => {
      const plain = e.get({ plain: true });
      const tickets = plain.tickets || [];
      const price = tickets.length ? Number(tickets[0].price) : 0;
      const remaining = tickets.length ? Number(tickets[0].quantity_available) : plain.capacity || 0;
      return {
        id: plain.event_id,
        title: plain.title,
        venue: plain.venue || "",
        city: plain.city,
        state: plain.state,
        category: plain.category,
        date: plain.start_date ? new Date(plain.start_date).toISOString().split("T")[0] : "",
        time: plain.start_date
          ? new Date(plain.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : "",
        seats: remaining,
        price,
        image: plain.image,
        description: plain.description,
      };
    });

    if (q) {
      const ql = q.toLowerCase();
      results = results
        .map((e) => {
          const titleSim = trigramSimilarity(ql, e.title);
          const venueSim = trigramSimilarity(ql, e.venue);
          const citySim = trigramSimilarity(ql, e.city || "");
          const catSim = trigramSimilarity(ql, e.category || "");
          const descHit = (e.description || "").toLowerCase().includes(ql) ? 0.35 : 0;
          const exact = e.title.toLowerCase().includes(ql) ? 0.5 : 0;
          const sim = Math.max(titleSim * 1.2 + exact, venueSim, citySim, catSim, descHit);
          return { ...e, _sim: sim };
        })
        .filter((e) => e._sim > 0.12)
        .sort((a, b) => b._sim - a._sim);
      results = results.map(({ _sim, ...e }) => e);
    }

    if (sort === "date") results.sort((a, b) => a.date.localeCompare(b.date));
    if (sort === "price") results.sort((a, b) => a.price - b.price);

    res.json({ results, count: results.length });
  })
);

// GET /api/predictions/search/suggestions?q= — type-ahead
router.get(
  "/search/suggestions",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json({ suggestions: [] });

    const events = await Event.findAll({
      attributes: ["event_id", "title", "category", "city"],
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${q}%` } },
          { category: { [Op.like]: `%${q}%` } },
          { city: { [Op.like]: `%${q}%` } },
        ],
      },
      limit: 40,
    });

    const seen = new Set();
    const suggestions = [];
    for (const e of events) {
      const p = e.get({ plain: true });
      if (p.title.toLowerCase().includes(q) && !seen.has(`t:${p.title}`)) {
        seen.add(`t:${p.title}`);
        suggestions.push({ type: "event", label: p.title, eventId: p.event_id, category: p.category });
      }
      if (p.category && p.category.toLowerCase().includes(q) && !seen.has(`c:${p.category}`)) {
        seen.add(`c:${p.category}`);
        suggestions.push({ type: "category", label: p.category });
      }
      if (p.city && p.city.toLowerCase().includes(q) && !seen.has(`l:${p.city}`)) {
        seen.add(`l:${p.city}`);
        suggestions.push({ type: "location", label: p.city });
      }
      if (suggestions.length >= 8) break;
    }
    res.json({ suggestions });
  })
);

export default router;
