import { describe, expect, it } from "vitest";
import { addDays, nearestWeekday, weekdayIndex } from "@/lib/dates";
import { timeChecker, timeOfDayRank } from "@/lib/conditions/time";
import type { TimeValue } from "@/lib/types";

// Anchor: 2026-01-01 is a Thursday, so 2026-01-05 is a Monday. Fully deterministic.
const MONDAY = new Date(2026, 0, 5);

function timeValue(partial: Partial<TimeValue>): TimeValue {
  return { kind: "date", at: null, weekday: null, daypart: null, ...partial };
}

describe("weekdayIndex", () => {
  it("maps Ukrainian names case-insensitively", () => {
    expect(weekdayIndex("понеділок")).toBe(1);
    expect(weekdayIndex("П'ятниця")).toBe(5);
    expect(weekdayIndex("неділя")).toBe(0);
  });
  it("maps English fallback", () => {
    expect(weekdayIndex("friday")).toBe(5);
  });
  it("returns null for unknown", () => {
    expect(weekdayIndex("бла")).toBeNull();
    expect(weekdayIndex(null)).toBeNull();
  });
});

describe("nearestWeekday (one-shot, relative to today)", () => {
  it("returns the same day when today already matches", () => {
    const d = nearestWeekday("понеділок", MONDAY)!;
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(5);
  });
  it("resolves 'до п'ятниці' to the nearest upcoming Friday", () => {
    const d = nearestWeekday("п'ятниця", MONDAY)!;
    expect(d.getDay()).toBe(5);
    expect(d.getDate()).toBe(9); // Jan 9 2026
  });
  it("resolves 'неділя' forward within the week", () => {
    const d = nearestWeekday("неділя", MONDAY)!;
    expect(d.getDay()).toBe(0);
    expect(d.getDate()).toBe(11);
  });
  it("returns null for unknown weekday", () => {
    expect(nearestWeekday("невідомо", MONDAY)).toBeNull();
  });
});

describe("addDays ('завтра')", () => {
  it("adds a day", () => {
    const t = addDays(MONDAY, 1);
    expect(t.getDate()).toBe(6);
  });
});

describe("timeChecker.holdsToday (day-granular)", () => {
  const ctx = { now: MONDAY };
  it("date today → true", async () => {
    const v = timeValue({ kind: "date", at: new Date(2026, 0, 5, 9).toISOString() });
    expect(await timeChecker.holdsToday({ type: "time", value: v }, ctx)).toBe(true);
  });
  it("date on another day → false", async () => {
    const v = timeValue({ kind: "date", at: new Date(2026, 0, 8).toISOString() });
    expect(await timeChecker.holdsToday({ type: "time", value: v }, ctx)).toBe(false);
  });
  it("daypart-only → shows today", async () => {
    const v = timeValue({ kind: "daypart", daypart: "morning" });
    expect(await timeChecker.holdsToday({ type: "time", value: v }, ctx)).toBe(true);
  });
  it("weekday matching today → true, otherwise false", async () => {
    const match = timeValue({ kind: "weekday", weekday: "понеділок" });
    const other = timeValue({ kind: "weekday", weekday: "п'ятниця" });
    expect(await timeChecker.holdsToday({ type: "time", value: match }, ctx)).toBe(true);
    expect(await timeChecker.holdsToday({ type: "time", value: other }, ctx)).toBe(false);
  });
});

describe("timeChecker.isOverdue (moment objectively passed by day)", () => {
  const ctx = { now: MONDAY };
  it("yesterday → overdue", async () => {
    const v = timeValue({ kind: "date", at: new Date(2026, 0, 4).toISOString() });
    expect(await timeChecker.isOverdue({ type: "time", value: v }, ctx)).toBe(true);
  });
  it("today → not overdue (day-granular)", async () => {
    const v = timeValue({ kind: "datetime", at: new Date(2026, 0, 5, 8).toISOString() });
    expect(await timeChecker.isOverdue({ type: "time", value: v }, ctx)).toBe(false);
  });
  it("daypart-only has no concrete moment → never overdue", async () => {
    const v = timeValue({ kind: "daypart", daypart: "evening" });
    expect(await timeChecker.isOverdue({ type: "time", value: v }, ctx)).toBe(false);
  });
});

describe("timeOfDayRank (intra-priority ordering)", () => {
  it("orders morning < afternoon < evening < no-time", () => {
    expect(timeOfDayRank(timeValue({ daypart: "morning" }))).toBe(0);
    expect(timeOfDayRank(timeValue({ daypart: "afternoon" }))).toBe(1);
    expect(timeOfDayRank(timeValue({ daypart: "evening" }))).toBe(2);
    expect(timeOfDayRank(timeValue({ kind: "date" }))).toBe(3);
  });
  it("derives time of day from a datetime hour", () => {
    const v = timeValue({ kind: "datetime", at: new Date(2026, 0, 5, 15).toISOString() });
    expect(timeOfDayRank(v)).toBe(1); // 15:00 → afternoon
  });
});
