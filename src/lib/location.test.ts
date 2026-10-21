import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchEvents } from "./api";
import { saveLocation, loadSavedLocation, clearSavedLocation } from "./location";

describe("saved location persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, loads and clears a location", () => {
    expect(loadSavedLocation()).toBeNull();

    saveLocation({ state: "Tamil Nadu", city: "Chennai" });
    expect(loadSavedLocation()).toEqual({ state: "Tamil Nadu", city: "Chennai" });

    clearSavedLocation();
    expect(loadSavedLocation()).toBeNull();
  });

  it("returns null for malformed saved data instead of crashing", () => {
    localStorage.setItem("eventra-location", "{not json");
    expect(loadSavedLocation()).toBeNull();
    localStorage.setItem("eventra-location", JSON.stringify({ state: "Only" }));
    expect(loadSavedLocation()).toBeNull();
  });
});

describe("fetchEvents location query", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests all events when no location is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchEvents();
    expect(fetchMock).toHaveBeenCalledWith("/api/events", expect.any(Object));
  });

  it("sends state and city as query params when a location is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchEvents({ state: "Tamil Nadu", city: "Chennai" });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/events?");
    expect(calledUrl).toContain("state=Tamil+Nadu");
    expect(calledUrl).toContain("city=Chennai");
  });
});
