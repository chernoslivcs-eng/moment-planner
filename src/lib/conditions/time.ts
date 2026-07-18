// Checker for condition.type === "time". Resolves instantly, but exposes the async
// signature the engine requires. Also provides the intra-priority ordering key for Today.

import type { Condition, Daypart, TimeValue } from "../types";
import { dayStart, isSameLocalDay, nearestWeekday } from "../dates";
import type { ConditionContext } from "./context";
import type { ConditionChecker } from "./checker";

function parseAt(at: string | null): Date | null {
  if (!at) return null;
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Whether a time condition makes the intent part of TODAY's list (day-granular, roadmap §3).
function timeHoldsToday(value: TimeValue, now: Date): boolean {
  switch (value.kind) {
    case "datetime":
    case "date": {
      const at = parseAt(value.at);
      // No concrete date given → treated as a "sometime today" default: show today.
      if (!at) return true;
      return isSameLocalDay(at, now);
    }
    case "weekday": {
      const nearest = nearestWeekday(value.weekday, now);
      if (!nearest) return true; // unknown weekday → don't hide the intent
      return isSameLocalDay(nearest, now);
    }
    case "daypart":
      // Daypart affects order, not appearance → part of today's list all day.
      return true;
    default:
      return true;
  }
}

// Whether the concrete moment has objectively passed (day-granular): drives release-on-open.
function timeIsOverdue(value: TimeValue, now: Date): boolean {
  if (value.kind !== "datetime" && value.kind !== "date") return false;
  const at = parseAt(value.at);
  if (!at) return false;
  return dayStart(at).getTime() < dayStart(now).getTime();
}

const DAYPART_RANK: Record<Daypart, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};

// Intra-priority ordering for Today: morning → afternoon → evening → no time.
export function timeOfDayRank(value: TimeValue): number {
  if (value.daypart) return DAYPART_RANK[value.daypart];
  if (value.kind === "datetime") {
    const at = parseAt(value.at);
    if (at) {
      const h = at.getHours();
      if (h < 12) return DAYPART_RANK.morning;
      if (h < 17) return DAYPART_RANK.afternoon;
      return DAYPART_RANK.evening;
    }
  }
  return 3; // no time of day
}

export const timeChecker: ConditionChecker<{ type: "time"; value: TimeValue }> = {
  type: "time",
  async holdsToday(condition, ctx: ConditionContext) {
    return timeHoldsToday(condition.value, ctx.now);
  },
  async isOverdue(condition, ctx: ConditionContext) {
    return timeIsOverdue(condition.value, ctx.now);
  },
};

// Ordering key for any condition (only time carries a time-of-day today).
export function conditionTimeOfDayRank(condition: Condition): number {
  return condition.type === "time" ? timeOfDayRank(condition.value) : 3;
}
