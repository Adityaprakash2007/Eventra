import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchStates,
  fetchCities,
  reverseGeocode,
  loadSavedLocation,
  saveLocation,
  type SavedLocation,
} from "@/lib/location";
import { cn } from "@/lib/utils";

export type LocationGateMode = "required" | "optional";

interface LocationGateProps {
  /** required = blocking popup on the events page until a location is picked */
  mode?: LocationGateMode;
  open: boolean;
  onApply: (loc: SavedLocation) => void;
  onClose?: () => void;
}

/**
 * "Select your location" popup: state dropdown → city dropdown → Show Events.
 * Cities load from countriesnow (cached) with a local fallback file; a
 * "Use my current location" button auto-fills both via Nominatim.
 */
export default function LocationGate({ mode = "required", open, onApply, onClose }: LocationGateProps) {
  const qc = useQueryClient();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [geo, setGeo] = useState<"idle" | "locating" | "error">("idle");
  const [geoMsg, setGeoMsg] = useState("");

  // Prefill from a saved location so returning users just confirm and continue
  useEffect(() => {
    if (!open) return;
    const saved = loadSavedLocation();
    if (saved) {
      setState(saved.state);
      setCity(saved.city);
    }
  }, [open]);

  // Reset transient geo state whenever the popup opens
  useEffect(() => {
    if (open) {
      setGeo("idle");
      setGeoMsg("");
    }
  }, [open]);

  const statesQuery = useQuery({
    queryKey: ["states"],
    queryFn: fetchStates,
    staleTime: Infinity,
  });

  const citiesQuery = useQuery({
    queryKey: ["cities", state],
    queryFn: () => fetchCities(state),
    enabled: open && !!state,
    staleTime: Infinity,
  });

  // If the saved/typed state isn't in the loaded list (e.g. API returned a
  // different spelling), keep it anyway so the flow doesn't reset on the user.
  const stateOptions = statesQuery.data ?? [];
  const cityOptions = citiesQuery.data ?? [];

  const handleStateChange = (v: string) => {
    setState(v);
    setCity("");
    qc.removeQueries({ queryKey: ["cities"] });
  };

  const canShow = state.trim().length > 0 && city.trim().length > 0;

  const apply = () => {
    if (!canShow) return;
    const loc = { state: state.trim(), city: city.trim() };
    saveLocation(loc);
    onApply(loc);
  };

  const useMyLocation = async () => {
    setGeo("locating");
    setGeoMsg("");
    try {
      const result = await reverseGeocode();
      // Keep whatever the geocoder gave us; dropdowns stay editable so the
      // user can correct a wrong guess before applying.
      setState(result.state ?? state);
      setCity(result.city ?? "");
      setGeo("idle");
      if (!result.city) setGeoMsg("Detected your state — please pick a city.");
    } catch (err) {
      setGeo("error");
      setGeoMsg(err instanceof Error ? err.message : "Could not detect your location");
    }
  };

  const dismissible = mode === "optional";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && dismissible) onClose?.(); }}>
      {/* In required mode the built-in close button is hidden — the popup
          blocks the events page until a location is picked. */}
      <DialogContent className={dismissible ? "sm:max-w-md" : "sm:max-w-md [&>button]:hidden"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
              <MapPin className="h-4 w-4" />
            </span>
            Select your location
          </DialogTitle>
          <DialogDescription>
            Choose your state and city to see events happening near you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — state */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="loc-state">State</Label>
              {state && <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">✓ selected</span>}
            </div>
            <Select value={state} onValueChange={handleStateChange} disabled={statesQuery.isLoading}>
              <SelectTrigger id="loc-state" className="w-full">
                <SelectValue placeholder={statesQuery.isLoading ? "Loading states…" : "Select state"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {stateOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statesQuery.isError && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" /> Couldn't load states — showing built-in list.
              </p>
            )}
          </div>

          {/* Step 2 — city (disabled until a state is chosen) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="loc-city">City</Label>
              {citiesQuery.isFetching && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading cities…
                </span>
              )}
            </div>
            <Select
              value={city}
              onValueChange={setCity}
              disabled={!state || citiesQuery.isFetching}
            >
              <SelectTrigger id="loc-city" className="w-full">
                <SelectValue
                  placeholder={
                    !state
                      ? "Select a state first"
                      : citiesQuery.isFetching
                        ? "Loading cities…"
                        : cityOptions.length
                          ? "Select city"
                          : "No cities available"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {cityOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!state && <p className="text-xs text-muted-foreground">Pick a state to load its cities.</p>}
            {state && !citiesQuery.isFetching && cityOptions.length === 0 && !citiesQuery.isError && (
              <p className="text-xs text-muted-foreground">No cities found for {state}.</p>
            )}
          </div>

          {/* Use my current location */}
          <div className="rounded-lg border border-dashed border-border/80 bg-card/50 p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={useMyLocation}
              disabled={geo === "locating"}
            >
              {geo === "locating" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Detecting your location…
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" /> Use my current location
                </>
              )}
            </Button>
            {geoMsg && (
              <p className={cn("mt-2 text-xs", geo === "error" ? "text-destructive" : "text-muted-foreground")}>
                {geoMsg}
              </p>
            )}
          </div>

          <Button className="w-full transition-all hover:shadow-glow-sm" disabled={!canShow} onClick={apply}>
            Show Events
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
