// Deterministic date primitives, resolved relative to a passed-in "today".
// Kept pure and framework-free so relative-date resolution is unit-testable
// (roadmap §4: "розв'язання відносних дат «завтра», «до п'ятниці» від переданої сьогоднішньої дати").

// JS getDay(): 0 = Sunday ... 6 = Saturday. Map Ukrainian (and English) weekday names to that.
const WEEKDAY_INDEX: Record<string, number> = {
  // Ukrainian
  "неділя": 0,
  "понеділок": 1,
  "вівторок": 2,
  "середа": 3,
  "четвер": 4,
  "п'ятниця": 5,
  "пʼятниця": 5, // modifier-letter apostrophe variant
  "пятниця": 5,
  "субота": 6,
  // English fallback
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function weekdayIndex(name: string | null | undefined): number | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return key in WEEKDAY_INDEX ? WEEKDAY_INDEX[key] : null;
}

// The browser's WALL-CALENDAR day as "YYYY-MM-DD", read from LOCAL components. This is the
// "today" the client hands the parser so relative dates ("сьогодні"/"завтра"/"вчора") resolve
// against the user's actual day. Deliberately NOT `toISOString()`: that emits a UTC date, which
// after midnight in a positive-offset zone (Kyiv, UTC+3) still points at the PRIOR calendar day
// — the night-shift bug where «сьогодні» parsed onto «вчора». Local getters never shift the day.
export function localCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// Server-side resolution of the "today" the client sent. The client posts its LOCAL calendar
// date (a plain "YYYY-MM-DD" from localCalendarDate); we trust that string VERBATIM — no Date
// round-trip, no timezone conversion — because only the browser knows the user's zone. Anything
// missing/malformed (a stale client, a bad body) falls back to the server's own local date.
export function resolveTodayISODate(bodyToday: unknown, now: Date = new Date()): string {
  if (typeof bodyToday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bodyToday)) {
    return bodyToday;
  }
  return localCalendarDate(now);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Start-of-day for calendar comparisons.
export function dayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Nearest occurrence of a weekday, counting today. One-shot semantics: "у п'ятницю" =
// the closest upcoming Friday (today if today is Friday). Returns null for unknown names.
export function nearestWeekday(name: string | null | undefined, from: Date): Date | null {
  const target = weekdayIndex(name);
  if (target === null) return null;
  const start = dayStart(from);
  const delta = (target - start.getDay() + 7) % 7; // 0..6, 0 = today
  return addDays(start, delta);
}
