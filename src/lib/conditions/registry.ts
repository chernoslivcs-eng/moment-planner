// Registry mapping condition.type → checker. Adding a new condition type (geo, weather, …)
// means registering one more module here — the core never changes (roadmap §2, "правило").

import type { Condition } from "../types";
import type { ConditionChecker } from "./checker";
import { timeChecker } from "./time";
import { noneChecker } from "./none";
import { locationChecker } from "./location";

const registry = new Map<Condition["type"], ConditionChecker>([
  ["time", timeChecker as ConditionChecker],
  ["none", noneChecker as ConditionChecker],
  ["location", locationChecker as ConditionChecker], // city phase — surfaces by current city
]);

export function checkerFor(type: Condition["type"]): ConditionChecker | undefined {
  return registry.get(type);
}
