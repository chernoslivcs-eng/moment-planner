// Resolves the user's CURRENT city for the location condition — real browser geolocation only,
// no dev switch, no fake. One request on open (getCurrentPosition, never watch); coordinates are
// reverse-geocoded to a city name via Nominatim (OpenStreetMap, free, keyless). Every failure
// path is silent: denied permission, no device, timeout, or a slow/unreachable Nominatim all
// resolve to `null` — geo just stays quiet and time/none intents work exactly as before.

import { useEffect, useState } from "react";

const SESSION_KEY = "mp.geo.city.v1"; // cache the resolved city for the session (Nominatim rate limit)
const GEO_TIMEOUT_MS = 10_000;
const NOMINATIM_TIMEOUT_MS = 8_000;

// Ask the browser for one position fix. Resolves null on any denial/error/timeout — never throws.
function getPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null), // permission denied / position unavailable → silent
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 5 * 60_000 },
    );
  });
}

// Pick the SETTLEMENT name from a Nominatim `address` block. Hard priority — a real settlement
// (city → town → village) ALWAYS wins over an administrative unit (municipality «…ська громада»,
// county); the admin fields are a last resort only when no settlement exists at all. This is why
// the reverse query runs at zoom=12: at zoom=10 the settlement fields come back empty for smaller
// cities (Львів, Славутич) and the chain used to fall through to the «…ська міська громада» admin
// name, which no longer matched the intent's «Львів»/«Славутич». Pure + exported for unit testing.
export function settlementFromAddress(
  a: Record<string, string | undefined>,
): string | null {
  // First NON-BLANK field in priority order — a present-but-blank `city: "   "` must not shadow a
  // real `town`, so `??` won't do (it only skips null/undefined). Settlement always beats admin.
  for (const raw of [a.city, a.town, a.village, a.municipality, a.county]) {
    const name = raw?.trim();
    if (name) return name;
  }
  return null;
}

// Nominatim reverse geocode → the settlement name in Ukrainian (accept-language=uk gives the
// nominative form, e.g. "Київ"), matching how the AI stores an intent's city. Null on any failure.
// zoom=12 resolves the settlement node (city/town/village) rather than the coarser admin boundary
// zoom=10 returns; see settlementFromAddress for the field priority.
async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&addressdetails=1` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=uk`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    return settlementFromAddress(data.address ?? {});
  } catch {
    return null; // aborted / offline / bad JSON → silent
  } finally {
    clearTimeout(timer);
  }
}

// One-shot resolve with a per-session cache so we hit Nominatim at most once per session.
export async function resolveCurrentCity(): Promise<string | null> {
  if (typeof window !== "undefined") {
    try {
      const cached = window.sessionStorage.getItem(SESSION_KEY);
      if (cached) return cached;
    } catch {
      /* sessionStorage blocked → just resolve live */
    }
  }
  const pos = await getPosition();
  if (!pos) return null;
  const city = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
  if (city && typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SESSION_KEY, city);
    } catch {
      /* ignore quota/availability */
    }
  }
  return city;
}

// React hook: resolves the current city once on mount and returns it (null until known/if silent).
export function useCurrentCity(): string | null {
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveCurrentCity().then((c) => {
      if (alive && c) setCity(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return city;
}
