// Крок 5 · Ланка 2 — «Реалістичність дня». A quiet estimate of how heavy today is, stated as a
// single non-blocking line. NOTHING here blocks, warns, or reproaches: it sums the approximate
// weight of the intents that ACTUALLY belong to today and states a fact, leaving the conclusion
// to the human.

import type { TodayView } from "./today";
import type { Intent } from "./types";

// Which intents count toward today's weight: the moment-based active ones («Готове до дії» —
// their moment holds today) plus the overdue ones («Прострочено» — still yours to clear today).
// Unconditional `none` intents («Будь-коли») are deliberately EXCLUDED: they are not about today,
// so counting them would lie about the day's load. A missing/null duration contributes nothing.
export function estimateTodayMinutes(view: TodayView): number {
  const countsToday = (i: Intent) => i.condition.type !== "none";
  const sum = (acc: number, i: Intent) =>
    acc + (typeof i.duration === "number" ? i.duration : 0);
  const active = view.active.filter(countsToday).reduce(sum, 0);
  const overdue = view.overdue.reduce(sum, 0);
  return active + overdue;
}

// Ukrainian plural for «година», including a fractional case: a non-integer hour count always
// takes the genitive singular «години» (1,5 години / 2,5 години).
function hoursUnit(hours: number): string {
  if (!Number.isInteger(hours)) return "години";
  const mod100 = hours % 100;
  const mod10 = hours % 10;
  if (mod100 >= 11 && mod100 <= 14) return "годин";
  if (mod10 === 1) return "годину";
  if (mod10 >= 2 && mod10 <= 4) return "години";
  return "годин";
}

// Turns a minute total into the quiet Today line, or null when there is nothing to state (an
// empty / all-null day must not hang an absurd «на 0 годин» row). The estimate is deliberately
// coarse — rounded to the nearest half-hour — and always prefixed with «приблизно», which drops
// a precision promise the model can't keep. Tone is a statement, never «overload»/«won't make it».
export function formatDayLoad(minutes: number): string | null {
  if (minutes <= 0) return null;
  const halfHours = Math.round(minutes / 30); // nearest 0.5 h
  const hours = halfHours / 2;
  if (hours === 0.5) return "сьогодні намірів приблизно на пів години";
  const numStr = Number.isInteger(hours) ? String(hours) : `${Math.floor(hours)},5`;
  return `сьогодні намірів приблизно на ${numStr} ${hoursUnit(hours)}`;
}
