/**
 * Location data for the "Select your location" flow.
 *
 * Primary source: countriesnow.space free API (no key needed).
 *   - POST https://countriesnow.space/api/v0.1/countries/states
 *   - POST https://countriesnow.space/api/v0.1/countries/state/cities
 * Fallback: local /data/states-cities.json served from public/.
 *
 * Successful API responses are cached in localStorage (24h) so the API is not
 * hit on every page load; if the API is slow/down the local file is used.
 *
 * No API keys are used. If you later switch to a paid API, read the key from
 * import.meta.env.VITE_GEO_API_KEY (put it in .env) — never hardcode it.
 */

export type StateCities = { state: string; cities: string[] };

const CACHE_KEY = "eventra-geo-cache-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_BASE = "https://countriesnow.space/api/v0.1/countries";
const COUNTRY = "India";
const API_TIMEOUT_MS = 6000;

type CacheShape = { fetchedAt: number; states: string[]; citiesByState: Record<string, string[]> };

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed?.states?.length || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage full/unavailable — cache is best-effort */
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Local fallback file (public/data/states-cities.json). */
export async function loadLocalStatesCities(): Promise<StateCities[]> {
  const res = await fetch("/data/states-cities.json");
  if (!res.ok) throw new Error(`Failed to load states-cities.json (${res.status})`);
  return (await res.json()) as StateCities[];
}

/** States of India via API; falls back to the local file. */
export async function fetchStates(): Promise<string[]> {
  const cached = readCache();
  if (cached) return cached.states;

  try {
    const res = await fetchWithTimeout(`${API_BASE}/states`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: COUNTRY }),
    });
    const json = await res.json();
    if (!res.ok || json?.error) throw new Error(json?.msg || `API ${res.status}`);
    const states: string[] = (json.data?.states ?? [])
      .map((s: { name?: string; state?: string } | string) => (typeof s === "string" ? s : s.name || s.state || ""))
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));
    if (!states.length) throw new Error("API returned no states");

    // Merge into any existing cached city data so we don't throw cities away
    const prev = readCache();
    writeCache({ fetchedAt: Date.now(), states, citiesByState: prev?.citiesByState ?? {} });
    return states;
  } catch {
    const local = await loadLocalStatesCities();
    return local.map((s) => s.state).sort((a, b) => a.localeCompare(b));
  }
}

/** Cities for one state via API; falls back to the local file. */
export async function fetchCities(state: string): Promise<string[]> {
  const cached = readCache();
  if (cached?.citiesByState?.[state]?.length) return cached.citiesByState[state];

  try {
    const res = await fetchWithTimeout(`${API_BASE}/state/cities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: COUNTRY, state }),
    });
    const json = await res.json();
    if (!res.ok || json?.error) throw new Error(json?.msg || `API ${res.status}`);
    const cities: string[] = (json.data ?? []).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b));
    if (!cities.length) throw new Error("API returned no cities");

    // Update cached city map for this state
    const base = readCache();
    writeCache({
      fetchedAt: base?.fetchedAt ?? Date.now(),
      states: base?.states ?? [],
      citiesByState: { ...(base?.citiesByState ?? {}), [state]: cities },
    });
    return cities;
  } catch {
    const local = await loadLocalStatesCities();
    const match = local.find((s) => s.state.toLowerCase() === state.toLowerCase());
    return match ? [...match.cities] : [];
  }
}

/* ── saved location (localStorage) ─────────────────────────────── */

export type SavedLocation = { state: string; city: string };

const LOCATION_KEY = "eventra-location";

export function loadSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    return parsed?.state && parsed?.city ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocation(loc: SavedLocation) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
  } catch {
    /* best-effort */
  }
}

export function clearSavedLocation() {
  try {
    localStorage.removeItem(LOCATION_KEY);
  } catch {
    /* best-effort */
  }
}

/* ── reverse geocoding (OpenStreetMap Nominatim — free, no key) ── */

export type ReverseGeoResult = { state: string | null; city: string | null };

/** Map common Nominatim city-name variants to the names used in our data. */
const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  madras: "Chennai",
  calcutta: "Kolkata",
  bombay: "Mumbai",
  trivandrum: "Thiruvananthapuram",
  cochin: "Kochi",
  mysore: "Mysuru",
  pondicherry: "Puducherry",
  gurgaon: "Gurugram",
  trichy: "Tiruchirappalli",
  vizag: "Visakhapatnam",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
};

function normalizeGeoName(name: string): string {
  const clean = name.trim();
  return CITY_ALIASES[clean.toLowerCase()] ?? clean;
}

/**
 * "Use my current location": browser Geolocation API + Nominatim reverse
 * geocoding. Throws on denial/timeout/failure so the caller can fall back to
 * the manual dropdowns.
 */
export async function reverseGeocode(): Promise<ReverseGeoResult> {
  if (!("geolocation" in navigator)) throw new Error("Geolocation is not supported by this browser");

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error(err.message || "Location permission denied")), {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    });
  });

  const { latitude, longitude } = pos.coords;
  const res = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const json = await res.json();
  const addr = json?.address ?? {};

  const state = addr.state ? normalizeGeoName(addr.state) : null;
  const rawCity = addr.city || addr.town || addr.village || addr.county || addr.state_district || null;
  const city = rawCity ? normalizeGeoName(rawCity) : null;

  if (!state && !city) throw new Error("Could not determine your location");
  return { state, city };
}
