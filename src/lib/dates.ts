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
