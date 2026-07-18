// Builds the Today view from the backlog. Membership is DERIVED (condition holds today),
// with a manual todayOverride escape hatch. Overdue open intents are surfaced muted for
// the release-on-open flow (roadmap §2). Re-run on every trigger, never cached.

import type { ConditionContext } from "./conditions/context";
import { holdsToday, isOverdue } from "./conditions/evaluate";
import { conditionTimeOfDayRank } from "./conditions/time";
import type { Intent, Priority } from "./types";

export interface TodayView {
  active: Intent[]; // today's plan
  overdue: Intent[]; // moment passed → shown muted with release/return
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// Explicit ordering so nothing is invented: priority (high→low), then time of day
// (morning→afternoon→evening→no time), then creation order as a stable tiebreak.
function compareForToday(a: Intent, b: Intent): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  const t = conditionTimeOfDayRank(a.condition) - conditionTimeOfDayRank(b.condition);
  if (t !== 0) return t;
  return a.createdAt.localeCompare(b.createdAt);
}

export async function buildToday(
  intents: Intent[],
  ctx: ConditionContext,
): Promise<TodayView> {
  const active: Intent[] = [];
  const overdue: Intent[] = [];

  for (const intent of intents) {
    if (intent.status !== "open") continue; // done/released never appear
    if (intent.todayOverride === "out") continue; // user pushed it out of today

    if (intent.todayOverride === "in") {
      active.push(intent); // user pinned it in — pin wins over derivation
      continue;
    }

    if (await isOverdue(intent.condition, ctx)) {
      overdue.push(intent);
      continue;
    }

    if (await holdsToday(intent.condition, ctx)) {
      active.push(intent);
    }
  }

  active.sort(compareForToday);
  overdue.sort(compareForToday);
  return { active, overdue };
}
