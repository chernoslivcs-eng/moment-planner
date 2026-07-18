import { describe, expect, it } from "vitest";
import { buildToday } from "@/lib/today";
import type { Intent, Priority, TimeValue } from "@/lib/types";

const MONDAY = new Date(2026, 0, 5);
const ctx = { now: MONDAY };

function tv(partial: Partial<TimeValue>): TimeValue {
  return { kind: "date", at: null, weekday: null, daypart: null, ...partial };
}

let seq = 0;
function intent(over: Partial<Intent> & { value?: Partial<TimeValue> }): Intent {
  const { value, ...rest } = over;
  seq += 1;
  return {
    id: `i${seq}`,
    text: `intent ${seq}`,
    priority: "medium",
    status: "open",
    condition: { type: "time", value: tv(value ?? { kind: "daypart", daypart: "morning" }) },
    createdAt: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    todayOverride: null,
    ...rest,
  };
}

describe("buildToday", () => {
  it("includes open intents whose time condition holds today", async () => {
    const i = intent({ value: { kind: "date", at: new Date(2026, 0, 5).toISOString() } });
    const { active } = await buildToday([i], ctx);
    expect(active.map((x) => x.id)).toEqual([i.id]);
  });

  it("excludes done and released intents", async () => {
    const done = intent({ status: "done" });
    const released = intent({ status: "released" });
    const { active, overdue } = await buildToday([done, released], ctx);
    expect(active).toHaveLength(0);
    expect(overdue).toHaveLength(0);
  });

  it("excludes intents whose condition holds on another day", async () => {
    const other = intent({ value: { kind: "date", at: new Date(2026, 0, 9).toISOString() } });
    const { active } = await buildToday([other], ctx);
    expect(active).toHaveLength(0);
  });

  it("todayOverride 'in' pins into today even when the condition is another day", async () => {
    const pinned = intent({
      todayOverride: "in",
      value: { kind: "date", at: new Date(2026, 0, 20).toISOString() },
    });
    const { active } = await buildToday([pinned], ctx);
    expect(active.map((x) => x.id)).toEqual([pinned.id]);
  });

  it("todayOverride 'out' removes from today even when the condition holds", async () => {
    const pushedOut = intent({
      todayOverride: "out",
      value: { kind: "date", at: new Date(2026, 0, 5).toISOString() },
    });
    const { active } = await buildToday([pushedOut], ctx);
    expect(active).toHaveLength(0);
  });

  it("surfaces overdue open intents in the muted bucket, not active", async () => {
    const past = intent({ value: { kind: "date", at: new Date(2026, 0, 4).toISOString() } });
    const { active, overdue } = await buildToday([past], ctx);
    expect(active).toHaveLength(0);
    expect(overdue.map((x) => x.id)).toEqual([past.id]);
  });

  it("sorts by priority (high→low), then time of day (morning→evening)", async () => {
    const mk = (p: Priority, daypart: "morning" | "evening") =>
      intent({ priority: p, value: { kind: "daypart", daypart } });
    const lowMorning = mk("low", "morning");
    const highEvening = mk("high", "evening");
    const highMorning = mk("high", "morning");
    const { active } = await buildToday([lowMorning, highEvening, highMorning], ctx);
    expect(active.map((x) => x.id)).toEqual([highMorning.id, highEvening.id, lowMorning.id]);
  });
});
