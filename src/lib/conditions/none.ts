// Checker for condition.type === "none" — an UNCONDITIONAL intent (no named time/circumstance).
// It is always relevant ("lives in Today") and, having no concrete moment, is NEVER overdue:
// the time-based release flow does not apply. A "none" intent leaves Today only by a human
// decision (done / manual remove) — never because a clock ticked past midnight.

import type { ConditionChecker } from "./checker";

export const noneChecker: ConditionChecker<{ type: "none" }> = {
  type: "none",
  async holdsToday() {
    return true; // unconditional → always part of today's list
  },
  async isOverdue() {
    return false; // no concrete moment → never released by the clock
  },
};
