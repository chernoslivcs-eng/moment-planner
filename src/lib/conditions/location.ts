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

// Strip a trailing administrative-unit phrase — «… (міська/сільська/селищна) громада», «… район»,
// «… область» — leaving the bare adjective ("львівський", "славутицька"). `isAdmin` says whether
// anything was actually removed (so a plain settlement noun is never mistaken for an admin form).
// \p{L} (any Unicode letter), NOT \w — \w is ASCII-only even under /u, so it would fail to
// consume the Cyrillic tails of «громада»/«область» (and the «міська» adjective), silently
// matching only «…район» and letting every feminine admin form slip through as a plain noun.
const ADMIN_TAIL =
  /\s+(?:(?:міськ|сільськ|селищн)\p{L}*)?\s*(?:громад\p{L}*|район\p{L}*|област\p{L}*)\s*$/u;
function stripAdmin(key: string): { base: string; isAdmin: boolean } {
  const base = key.replace(ADMIN_TAIL, "").trim();
  return { base, isAdmin: base.length > 0 && base.length < key.length };
}

// Reduce an administrative ADJECTIVE ("львівський", "славутицька") to its stem by dropping the
// gender ending only ("-ий"/"-ій" or a trailing vowel), keeping the mutated cluster (ськ/цьк/зьк).
function adjStem(adj: string): string {
  if (/(?:ий|ій)$/u.test(adj)) return adj.slice(0, -2);
  if (/[аеєиіоуюяї]$/u.test(adj)) return adj.slice(0, -1);
  return adj;
}

// Derive the adjective stem FORWARD from a settlement NOUN via the consonant-mutation table Ukrainian
// relational adjectives use — ч→ц, к→ц, г→з (base consonant + "-ськ-" fuses to -цьк-/-зьк-) — then the
// plain "-ськ" for every other ending. So "славутич" → "славутицьк" (== adjStem of "Славутицька") but
// "славута" → "славутаськ" (≠), keeping the near-twins apart. Vowel alternation (Кривий Ріг →
// Криворізький) is a known, deliberately-uncovered boundary.
function nounToAdjStem(noun: string): string {
  const last = noun.slice(-1);
  if (last === "ч" || last === "к") return `${noun.slice(0, -1)}цьк`;
  if (last === "г") return `${noun.slice(0, -1)}зьк`;
  return `${noun}ськ`;
}

// True when two city names denote the same city. Empty/blank never matches. Noun↔noun is EXACT
// (so «Славутич» ≠ «Славута»); an administrative form matches its settlement ONLY by exact stem
// equality after mutation — never by prefix — so «Славутська громада» ≠ «Славутич».
export function sameCity(a: string, b: string): boolean {
  const ka = cityKey(a);
  const kb = cityKey(b);
  if (ka.length === 0 || kb.length === 0) return false;

  const A = stripAdmin(ka);
  const B = stripAdmin(kb);

  // Neither is an administrative unit → compare plain settlement nouns exactly (near-twins stay apart).
  if (!A.isAdmin && !B.isAdmin) return ka === kb;

  // At least one admin form: compare adjective stems (admin → drop gender; noun → forward mutation).
  const stemA = A.isAdmin ? adjStem(A.base) : nounToAdjStem(A.base);
  const stemB = B.isAdmin ? adjStem(B.base) : nounToAdjStem(B.base);
  if (stemA.length < 4 || stemB.length < 4) return false; // guard against degenerate short stems
  return stemA === stemB;
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
