// The evaluation context is passed IN to checkers, never read from inside them
// (roadmap §2, architectural requirement 2). Time needs only `now`; the location checker
// additionally reads `city` — the user's CURRENT city (nominative), resolved once per session
// by the geolocation layer. It is optional: when geo is denied/unavailable/slow the field is
// simply absent and location conditions never surface (silent fallback, never a crash).

export interface ConditionContext {
  now: Date;
  city?: string | null; // current city (nominative) or null/undefined when unknown
  // later: weather?: ...
}

// Base context. The current city is resolved asynchronously by the UI (useCurrentCity) and
// passed in here before evaluation — omitting it keeps every time/none evaluation working
// exactly as before, geo simply off.
export function currentContext(city?: string | null): ConditionContext {
  return { now: new Date(), city };
}
