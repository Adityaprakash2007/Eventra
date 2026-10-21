import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reverseGeocode } from "@/lib/location";
import { cn } from "@/lib/utils";

// Fix default Leaflet marker icons under bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type LatLng = { lat: number; lng: number };

/** Haversine distance in km between two coordinates. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Get the visitor's coordinates (best-effort; null on denial). */
export function getUserCoords(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export interface VenueMapProps {
  lat?: number | null;
  lng?: number | null;
  /** Fallback search string when no coordinates are set (city, venue). */
  query?: string;
  title?: string;
  height?: number;
  className?: string;
  /** Show "Get directions" + distance controls. */
  showDirections?: boolean;
}

/**
 * OpenStreetMap embed (Leaflet used directly — no react-leaflet, which
 * requires React 19) — no API key, no billing. Shows the venue marker, a
 * directions deep-link, and the visitor's distance to the venue. When
 * coordinates are missing it falls back to Nominatim geocoding of the
 * venue/city string.
 */
export default function VenueMap({
  lat,
  lng,
  query,
  title,
  height = 280,
  className,
  showDirections = true,
}: VenueMapProps) {
  const [resolved, setResolved] = useState<LatLng | null>(lat != null && lng != null ? { lat, lng } : null);
  const [geoState, setGeoState] = useState<"idle" | "resolving" | "failed">(
    lat != null && lng != null ? "idle" : query ? "resolving" : "failed"
  );
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Geocode the venue string when no stored coordinates exist.
  // Tries the full query first, then progressively simpler ones — venues like
  // "Government College Ground, Shillong" get a doubled city when the caller
  // appends it ("…, Shillong, Shillong, Meghalaya"), which Nominatim rejects.
  useEffect(() => {
    if (resolved || !query || geoState !== "resolving") return;
    let cancelled = false;
    const parts = query.split(",").map((p) => p.trim()).filter(Boolean);
    const attempts = Array.from(
      new Set([query, parts.slice(0, -1).join(", "), parts[0]].filter(Boolean))
    );
    (async () => {
      for (const q of attempts) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
            { headers: { Accept: "application/json" } }
          );
          const json = await res.json();
          if (cancelled) return;
          if (json?.[0]) {
            setResolved({ lat: Number(json[0].lat), lng: Number(json[0].lon) });
            setGeoState("idle");
            return;
          }
        } catch {
          if (cancelled) return;
        }
      }
      if (!cancelled) setGeoState("failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [resolved, query, geoState]);

  // Create the Leaflet map once the container exists, then keep view + marker
  // in sync with `resolved` (geocode results can arrive after mount).
  useEffect(() => {
    if (!resolved || !mapElRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapElRef.current, {
        center: [resolved.lat, resolved.lng],
        zoom: 15,
        scrollWheelZoom: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const marker = L.marker([resolved.lat, resolved.lng]).addTo(map);
      if (title) marker.bindPopup(title);
      mapRef.current = map;
      markerRef.current = marker;
    } else {
      mapRef.current.setView([resolved.lat, resolved.lng], mapRef.current.getZoom());
      markerRef.current?.setLatLng([resolved.lat, resolved.lng]);
      if (title) markerRef.current?.bindPopup(title);
    }
  }, [resolved, title]);

  // Tear down Leaflet on unmount (StrictMode-safe: create → remove → create).
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Distance: resolve the visitor's position lazily
  const [distancing, setDistancing] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const directionsUrl = useMemo(() => {
    if (!resolved) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${resolved.lat},${resolved.lng}`;
  }, [resolved]);

  const landmarksUrl = useMemo(() => {
    if (!resolved) return null;
    return `https://www.google.com/maps/search/?api=1&query=${resolved.lat},${resolved.lng}&zoom=15`;
  }, [resolved]);

  const measureDistance = async () => {
    setDistancing(true);
    const pos = await getUserCoords();
    if (pos && resolved) setDistance(distanceKm(pos, resolved));
    setDistancing(false);
  };

  if (geoState === "failed" && !resolved) {
    return (
      <div
        className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 text-center", className)}
        style={{ height }}
      >
        <p className="text-sm font-medium">Map unavailable</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          No coordinates are stored for this venue{query ? ` (${query})` : ""}. The organizer can set them while creating the event.
        </p>
        {directionsUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={directionsUrl} target="_blank" rel="noreferrer">Open in Maps</a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", className)}>
      {resolved ? (
        <div
          ref={mapElRef}
          style={{ height, width: "100%" }}
          role="application"
          aria-label={title ? `Map of ${title}` : "Venue map"}
        />
      ) : (
        <div className="flex items-center justify-center bg-muted/40" style={{ height }}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {showDirections && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          {directionsUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={directionsUrl} target="_blank" rel="noreferrer">
                <Navigation className="h-3.5 w-3.5" /> Get directions
              </a>
            </Button>
          )}
          {landmarksUrl && (
            <Button asChild size="sm" variant="ghost" className="gap-1.5">
              <a href={landmarksUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Nearby
              </a>
            </Button>
          )}
          {distance == null ? (
            <Button size="sm" variant="ghost" onClick={measureDistance} disabled={distancing} className="gap-1.5">
              {distancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {distance == null ? "Distance from me" : ""}
            </Button>
          ) : (
            <span className="ml-auto text-xs font-medium text-muted-foreground">
              {distance.toFixed(1)} km away
            </span>
          )}
        </div>
      )}
    </div>
  );
}
