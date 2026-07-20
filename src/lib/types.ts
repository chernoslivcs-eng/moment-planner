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

// value for condition.type === "location" — the "city" phase.
// A location condition is understood by CITY NAME alone: the city as the AI resolved it,
// normalized to the nominative case ("у Львові" / "до Львова" → "Львів"). No coordinates
// and no radius here — the city works on name only; geometry belongs to the later phase.
export interface CityValue {
  city: string;
}

// RESERVED for the later point/brand phase (a named place with a geofence: coordinates +
// radius). NOT produced by the parser in the city phase and intentionally NOT wired into the
// Condition union yet — kept as the shape that phase will adopt. Do not touch in the city phase.
export interface LocationValue {
  placeName: string;
  lat: number;
  lng: number;
  radiusM: number;
}

// Polymorphic condition. Discriminated union keyed by `type`.
//   - "time": relevant when its named moment/day holds.
//   - "location": relevant when the user is in the named CITY (city phase → CityValue). Its
//     checker is position-driven and arrives in the geolocation phase; until then a location
//     intent simply never surfaces in Today (no checker → holdsToday false) and waits under
//     «Заплановано».
//   - "none": UNCONDITIONAL — no named time/place. A legitimate timeless constant, not a
//     "today" default. It lives in Today permanently and is never released by the clock; it
//     leaves only by a human decision (done / manual remove). Carries no value.
export type Condition =
  | { type: "time"; value: TimeValue }
  | { type: "location"; value: CityValue }
  | { type: "none" };

export type ConditionType = Condition["type"];

// A parsed candidate as returned by /api/parse and validated: no human/system fields yet.
export interface ParsedIntent {
  text: string;
  priority: Priority;
  // Whether the intent repeats (Крок 2). Meaningful only for a location condition — a thing
  // done every time the person is back in that city. The model sets it; validation coerces any
  // non-boolean to false. Time/unconditional intents are always false.
  recurring: boolean;
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
  // Forward-looking schema fields (Крок 1). Present with defaults ahead of the features that
  // will read them — NO behaviour reads them yet. Recurrence will later be a modifier over the
  // existing polymorphic condition, not a new condition shape.
  recurring: boolean; // default false — future geo-recurrence
  duration: number | null; // minutes, default null — future plan realism
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
