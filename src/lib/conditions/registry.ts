// Registry mapping condition.type → checker. Adding a new condition type (geo, weather, …)
// means registering one more module here — the core never changes (roadmap §2, "правило").

import type { Condition } from "../types";
import type { ConditionChecker } from "./checker";
import { timeChecker } from "./time";
import { noneChecker } from "./none";

const registry = new Map<Condition["type"], ConditionChecker>([
  ["time", timeChecker as ConditionChecker],
  ["none", noneChecker as ConditionChecker],
  // ["location", locationChecker], // second wave
]);

export function checkerFor(type: Condition["type"]): ConditionChecker | undefined {
  return registry.get(type);
}
