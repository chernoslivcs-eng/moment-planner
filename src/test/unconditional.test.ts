import { describe, expect, it } from "vitest";
import { normalizeParseResponse } from "@/lib/parse/normalize";
import { buildToday } from "@/lib/today";
import type { Condition, Intent } from "@/lib/types";

// Anchor: 2026-01-05 is a Monday, 2026-01-06 the Tuesday after. Fully deterministic.
const MONDAY = new Date(2026, 0, 5);
const TUESDAY = new Date(2026, 0, 6);

let seq = 0;
function intent(condition: Condition): Intent {
  seq += 1;
  return {
    id: `i${seq}`,
    text: `intent ${seq}`,
    priority: "medium",
    status: "open",
    condition,
    createdAt: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    todayOverride: null,
  };
}

// The control distinction the refactor must guarantee: "сьогодні почитати книжку" and
// "почитати книжку" (no time) must NOT be indistinguishable. One is a dated time intent
// that ages into the overdue bucket; the other is an unconditional constant that stays.
describe("unconditional vs today-dated intents are distinguishable", () => {
  it("parses a named time as time, but no-time input as none — not the same bytes", () => {
    // "сьогодні почитати книжку" → the model resolves a concrete date for today.
    const withTime = normalizeParseResponse([
      {
        text: "почитати книжку",
        condition: { type: "time", value: { kind: "date", at: MONDAY.toISOString() } },
      },
    ]);
    // "почитати книжку" → no time named at all.
    const noTime = normalizeParseResponse([
      { text: "почитати книжку", condition: { type: "none" } },
    ]);

    expect(withTime[0].condition.type).toBe("time");
    expect(noTime[0].condition.type).toBe("none");
    // Same text, genuinely different conditions — the ambiguity is gone.
    expect(withTime[0].condition).not.toEqual(noTime[0].condition);
  });

  it("a time intent dated today surfaces today, then becomes overdue the next day", async () => {
    const t = intent({ type: "time", value: { kind: "date", at: MONDAY.toISOString(), weekday: null, daypart: null } });

    const mon = await buildToday([t], { now: MONDAY });
    expect(mon.active.map((x) => x.id)).toEqual([t.id]);
    expect(mon.overdue).toHaveLength(0);

    const tue = await buildToday([t], { now: TUESDAY });
    expect(tue.active).toHaveLength(0);
    expect(tue.overdue.map((x) => x.id)).toEqual([t.id]); // time-logic released it
  });

  it("an unconditional (none) intent stays in today across days, never overdue", async () => {
    const n = intent({ type: "none" });

    const mon = await buildToday([n], { now: MONDAY });
    expect(mon.active.map((x) => x.id)).toEqual([n.id]);
    expect(mon.overdue).toHaveLength(0);

    const tue = await buildToday([n], { now: TUESDAY });
    expect(tue.active.map((x) => x.id)).toEqual([n.id]); // STILL here
    expect(tue.overdue).toHaveLength(0); // never fades, never in "Минуло"
  });
});
