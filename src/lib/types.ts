// Core data model — the contract from roadmap section 2.
// The entity is an Intent (not a "task"): a thing waiting for its circumstance.
// The condition is POLYMORPHIC ({ type, value }), never flattened into time/deadline fields.
// Adding a new condition type = adding a new variant + checker module, not rewriting the core.

export type Priority = "high" | "medium" | "low";

// Stored status holds ONLY human decisions. Whether an intent is *relevant right now*
// (whether it "surfaced") is derived on the fly, never stored.
export type Status = "open" | "done" | "released";

export type Daypart = "morning" | "afternoon" | "evening";

// value for condition.type === "time"
export interface TimeValue {
  kind: "datetime" | "date" | "weekday" | "daypart";
  at: string | null; // ISO timestamp — concrete moment/deadline
  weekday: string | null; // weekday name — ONE-SHOT ("nearest specified"), never recurring
  daypart: Daypart | null;
}

// value for condition.type === "location" (second wave — not built in this step, shape reserved)
export interface LocationValue {
  placeName: string;
  lat: number;
  lng: number;
  radiusM: number;
}

// Polymorphic condition. Discriminated union keyed by `type`.
// Core only produces/handles the "time" variant; "location" is reserved for the next wave.
export type Condition =
  | { type: "time"; value: TimeValue }
  | { type: "location"; value: LocationValue };

export type ConditionType = Condition["type"];

// A parsed candidate as returned by /api/parse and validated: no human/system fields yet.
export interface ParsedIntent {
  text: string;
  priority: Priority;
  condition: Condition;
}

// A parsed intent held in the Inbox review buffer (separate from the committed backlog),
// so Intent.status stays human-only. `cid` is an ephemeral client id; `pinToday` records
// a pre-set "в сьогодні" choice applied when the candidate is committed.
export interface Candidate extends ParsedIntent {
  cid: string;
  pinToday?: boolean;
}

export interface Intent {
  id: string;
  text: string; // the intent itself, as the AI parsed it
  priority: Priority;
  status: Status; // ONLY human decisions (open | done | released)
  condition: Condition;
  createdAt: string; // ISO
  // Manual Today-membership override (roadmap §1/§3 actions "в сьогодні" / "прибрати з сьогодні").
  // null = follow the derived condition. Additive; does not touch the polymorphic condition.
  todayOverride?: "in" | "out" | null;
}

export const PRIORITIES: readonly Priority[] = ["high", "medium", "low"];
export const STATUSES: readonly Status[] = ["open", "done", "released"];
export const DAYPARTS: readonly Daypart[] = ["morning", "afternoon", "evening"];
export const TIME_KINDS: readonly TimeValue["kind"][] = [
  "datetime",
  "date",
  "weekday",
  "daypart",
];
