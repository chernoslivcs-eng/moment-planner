import { describe, expect, it } from "vitest";
import { distributeByDeadline } from "@/lib/schedule";
import type { OccupiedSlot, ScheduleTask } from "@/lib/schedule";

// Deterministic anchor day: 2026-01-05 (a Monday). All times are wall-clock on that day,
// built with the local Date constructor so the engine's Date math is zone-neutral.
const DAY = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0, 0);

// Helper: read back placements as a {id: "HH:MM"} map for readable assertions.
function starts(placed: { id: string; start: Date }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of placed) {
    const h = String(p.start.getHours()).padStart(2, "0");
    const m = String(p.start.getMinutes()).padStart(2, "0");
    out[p.id] = `${h}:${m}`;
  }
  return out;
}

const task = (id: string, duration = 60): ScheduleTask => ({ id, duration });
const slot = (fromH: number, toH: number): OccupiedSlot => ({
  start: DAY(fromH),
  end: DAY(toH),
});

describe("distributeByDeadline — happy path (nothing occupied)", () => {
  it("lays 3 hour-long tasks backward from 20:00, now 15:00 → 17,18,19", () => {
    const res = distributeByDeadline({
      tasks: [task("a"), task("b"), task("c")],
      deadline: DAY(20),
      now: DAY(15),
      occupied: [],
    });
    expect(res.overflow).toEqual([]);
    // input order maps to chronological order: first-said is earliest
    expect(starts(res.placed)).toEqual({ a: "17:00", b: "18:00", c: "19:00" });
    // placed is returned in chronological order
    expect(res.placed.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("packs contiguously backward regardless of the window slack", () => {
    // deadline far in the future — tasks still hug the deadline, not `now`.
    const res = distributeByDeadline({
      tasks: [task("a"), task("b")],
      deadline: DAY(22),
      now: DAY(9),
      occupied: [],
    });
    expect(starts(res.placed)).toEqual({ a: "20:00", b: "21:00" });
  });

  it("respects sub-hour durations", () => {
    const res = distributeByDeadline({
      tasks: [task("a", 30), task("b", 30)],
      deadline: DAY(20),
      now: DAY(15),
      occupied: [],
    });
    expect(starts(res.placed)).toEqual({ a: "19:00", b: "19:30" });
  });
});

describe("distributeByDeadline — working around occupied datetime slots", () => {
  it("jumps over an occupied 18:00–19:00 slot", () => {
    const res = distributeByDeadline({
      tasks: [task("a"), task("b"), task("c")],
      deadline: DAY(20),
      now: DAY(15),
      occupied: [slot(18, 19)],
    });
    expect(res.overflow).toEqual([]);
    // c hugs deadline [19,20); b can't sit at [18,19) (occupied) → jumps to [17,18);
    // a sits before b at [16,17).
    expect(starts(res.placed)).toEqual({ a: "16:00", b: "17:00", c: "19:00" });
  });

  it("boundary touch is not an overlap (task may end exactly when a slot starts)", () => {
    const res = distributeByDeadline({
      tasks: [task("a")],
      deadline: DAY(19),
      now: DAY(9),
      occupied: [slot(19, 20)],
    });
    expect(starts(res.placed)).toEqual({ a: "18:00" });
  });
});

describe("distributeByDeadline — never into the past", () => {
  it("overflows the tasks that cannot fit before the deadline", () => {
    // now 18:30, deadline 20:00 → 90 min window; three hour-long tasks → only one fits.
    const res = distributeByDeadline({
      tasks: [task("a"), task("b"), task("c")],
      deadline: DAY(20),
      now: DAY(18, 30),
      occupied: [],
    });
    // the task hugging the deadline is placed; the earlier ones overflow.
    expect(starts(res.placed)).toEqual({ c: "19:00" });
    expect(res.overflow).toEqual(["a", "b"]);
  });

  it("a smaller earlier task can still slot in when a bigger one overflowed", () => {
    // now 18:00, deadline 20:00 → 120 min. c=60 (19–20), b=60 would need 18–19 (fits),
    // a=15 fits 17:45? no — must end before b(18:00) and be >= now(18:00) → cannot → overflow.
    const res = distributeByDeadline({
      tasks: [task("a", 60), task("b", 60), task("c", 60)],
      deadline: DAY(20),
      now: DAY(18),
      occupied: [],
    });
    expect(starts(res.placed)).toEqual({ b: "18:00", c: "19:00" });
    expect(res.overflow).toEqual(["a"]);
  });
});

describe("distributeByDeadline — degenerate inputs", () => {
  it("empty task list → empty result", () => {
    const res = distributeByDeadline({
      tasks: [],
      deadline: DAY(20),
      now: DAY(15),
      occupied: [],
    });
    expect(res.placed).toEqual([]);
    expect(res.overflow).toEqual([]);
  });

  it("deadline already passed → everything overflows", () => {
    const res = distributeByDeadline({
      tasks: [task("a")],
      deadline: DAY(14),
      now: DAY(15),
      occupied: [],
    });
    expect(res.placed).toEqual([]);
    expect(res.overflow).toEqual(["a"]);
  });

  it("occupied slots outside the window are ignored", () => {
    const res = distributeByDeadline({
      tasks: [task("a")],
      deadline: DAY(20),
      now: DAY(15),
      occupied: [slot(10, 11), slot(21, 22)],
    });
    expect(starts(res.placed)).toEqual({ a: "19:00" });
  });
});
