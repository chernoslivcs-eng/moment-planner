// Human-readable Ukrainian labels for conditions and priorities (display only).

import type { Condition, Daypart, Priority, TimeValue } from "./types";
import { addDays, isSameLocalDay } from "./dates";

const DAYPART_LABEL: Record<Daypart, string> = {
  morning: "Зранку",
  afternoon: "Вдень",
  evening: "Ввечері",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Високий",
  medium: "Середній",
  low: "Низький",
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

export function describeCondition(condition: Condition, now: Date = new Date()): string {
  if (condition.type === "time") return describeTime(condition.value, now);
  if (condition.type === "none") return "Будь-коли"; // unconditional — relevant any time
  // location (city phase): the city name as the model resolved it (nominative). Declension-free
  // so it reads correctly for any city; the place icon/section already frame it as a place.
  return condition.value.city;
}
