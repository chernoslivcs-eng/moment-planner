// Human-readable Ukrainian labels for conditions and priorities (display only).

import type { Condition, Daypart, Priority, TimeValue } from "./types";
import { addDays, isSameLocalDay } from "./dates";

const DAYPART_LABEL: Record<Daypart, string> = {
  morning: "Зранку",
  afternoon: "Вдень",
  evening: "Ввечері",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "важливе",
  medium: "буденне",
  low: "колись",
};

export function priorityLabel(p: Priority): string {
  return PRIORITY_LABEL[p];
}

// Ukrainian plural for "намір": 1 намір, 2–4 наміри, 5+ намірів (with teen exceptions).
export function pluralizeIntents(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "намірів";
  if (mod10 === 1) return "намір";
  if (mod10 >= 2 && mod10 <= 4) return "наміри";
  return "намірів";
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function formatDate(d: Date, now: Date): string {
  if (isSameLocalDay(d, now)) return "Сьогодні";
  if (isSameLocalDay(d, addDays(now, 1))) return "Завтра";
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(d);
}

// Wall-clock time, zone-neutral. `at` is a naive ISO string (no offset) holding the exact
// hour the user named. We pin its components to UTC purely for formatting — parse with a
// trailing `Z` and render with timeZone:"UTC" — so the shown hour equals the typed hour on
// any server/browser. No local offset is ever added or subtracted (18:00 in → 18:00 out).
// The date label above stays browser-local on purpose: it answers "is this the user's today".
function formatTime(at: string): string {
  const d = new Date(`${at.replace(/Z$/, "")}Z`);
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

function describeTime(value: TimeValue, now: Date): string {
  switch (value.kind) {
    case "datetime": {
      if (!value.at) return "Сьогодні";
      // Date label from a local parse (recovers the wall calendar day robustly); time from
      // the raw wall string (zone-neutral). Both read the same naive `at`, no offset applied.
      const d = new Date(value.at);
      return `${formatDate(d, now)}, ${formatTime(value.at)}`;
    }
    case "date": {
      if (!value.at) return "Сьогодні";
      const label = formatDate(new Date(value.at), now);
      return value.daypart ? `${label}, ${DAYPART_LABEL[value.daypart].toLowerCase()}` : label;
    }
    case "weekday":
      return value.weekday ? capitalize(value.weekday) : "Найближчим часом";
    case "daypart":
      return value.daypart ? DAYPART_LABEL[value.daypart] : "Сьогодні";
    default:
      return "Сьогодні";
  }
}

// Locative ("у Львові") derived ON THE FLY from the stored nominative ("Львів") — the recurring
// chip reads «щоразу у Львові». Demo-city dictionary now; a declension function replaces it on
// prod. Unknown cities fall back to a grammatically safe «у місті X».
const CITY_LOCATIVE: Record<string, string> = {
  Київ: "у Києві",
  Львів: "у Львові",
  Вінниця: "у Вінниці",
  Одеса: "в Одесі",
};

export function cityLocative(city: string): string {
  return CITY_LOCATIVE[city] ?? `у місті ${city}`;
}

export interface DescribeConditionOptions {
  // Recurrence lives IN the condition wording (not a separate badge): a recurring location
  // reads «щоразу у Львові» instead of the flat city name. Only affects location conditions.
  recurring?: boolean;
}

export function describeCondition(
  condition: Condition,
  now: Date = new Date(),
  opts: DescribeConditionOptions = {},
): string {
  if (condition.type === "time") return describeTime(condition.value, now);
  if (condition.type === "none") return "Будь-коли"; // unconditional — relevant any time
  // location (city phase): recurring → «щоразу у Львові» (locative on the fly); otherwise the
  // flat nominative city as the model resolved it. The place icon already frames it as a place.
  if (opts.recurring) return `щоразу ${cityLocative(condition.value.city)}`;
  return condition.value.city;
}
