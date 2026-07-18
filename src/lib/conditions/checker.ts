// A condition checker resolves whether a condition is relevant, given external context.
// The signature is ASYNC from day one (roadmap §2, requirement 1): time resolves instantly,
// but geo/weather will be external calls — building sync now would force a rewrite later.
// Adding a new condition type = adding a new checker module + registering it, not touching core.

import type { Condition } from "../types";
import type { ConditionContext } from "./context";

export interface ConditionChecker<C extends Condition = Condition> {
  type: C["type"];
  // Does this condition make the intent relevant for *today* (the day list)?
  holdsToday(condition: C, ctx: ConditionContext): Promise<boolean>;
  // Has this condition's concrete moment objectively passed (for the release-on-open flow)?
  // Only meaningful for conditions with a concrete moment; others return false.
  isOverdue(condition: C, ctx: ConditionContext): Promise<boolean>;
}
