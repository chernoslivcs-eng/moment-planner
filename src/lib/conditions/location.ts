// Checker for condition.type === "location" — the "city" phase. An intent is relevant TODAY
// when the user's CURRENT city (ctx.city, resolved by the geolocation layer) is the city the
// intent named. This is a STATE of relevance recomputed on every trigger, not a permanent move:
// leave the city and the intent quietly drops back to «Заплановано» on the next evaluation.
//
// The check is async by contract (like every checker) and reads the current city from the
// context passed IN — the checker never calls geolocation itself (roadmap §2, requirement 2).

import type { CityValue } from "../types";
import type { ConditionContext } from "./context";
import type { ConditionChecker } from "./checker";

// Comparison key so the intent's city (nominative, from the AI) and the current city (nominative,
// from reverse-geocoding) match despite case/spacing or a leading "м."/"місто" prefix.
function cityKey(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase("uk")
    .replace(/^м\.?\s+/u, "")
    .replace(/^місто\s+/u, "")
    .trim();
}

// True when two city names denote the same city. Empty/blank never matches anything.
export function sameCity(a: string, b: string): boolean {
  const ka = cityKey(a);
  return ka.length > 0 && ka === cityKey(b);
}

export const locationChecker: ConditionChecker<{ type: "location"; value: CityValue }> = {
  type: "location",
  async holdsToday(condition, ctx: ConditionContext) {
    const here = ctx.city;
    // No known current city (geo denied/unavailable/slow) → the intent stays quiet, never surfaced.
    if (!here) return false;
    return sameCity(here, condition.value.city);
  },
  async isOverdue() {
    // A place condition carries no moment — the clock never makes it "overdue".
    return false;
  },
};
