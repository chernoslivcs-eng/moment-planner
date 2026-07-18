// Evaluate an intent's condition through the registry. Async + context-driven + designed
// to be re-run on every trigger (open / focus), never computed once at startup (roadmap §2).

import type { Condition } from "../types";
import type { ConditionContext } from "./context";
import { checkerFor } from "./registry";

export async function holdsToday(
  condition: Condition,
  ctx: ConditionContext,
): Promise<boolean> {
  const checker = checkerFor(condition.type);
  if (!checker) return false; // unknown/locked type → not relevant yet
  return checker.holdsToday(condition, ctx);
}

export async function isOverdue(
  condition: Condition,
  ctx: ConditionContext,
): Promise<boolean> {
  const checker = checkerFor(condition.type);
  if (!checker) return false;
  return checker.isOverdue(condition, ctx);
}
