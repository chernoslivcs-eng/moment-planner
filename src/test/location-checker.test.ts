import { describe, expect, it } from "vitest";
import { locationChecker } from "@/lib/conditions/location";
import { buildToday } from "@/lib/today";
import type { Intent } from "@/lib/types";

const NOW = new Date(2026, 0, 5); // deterministic; irrelevant to a place condition
const KYIV = { type: "location", value: { city: "Київ" } } as const;

describe("locationChecker.holdsToday (surfaces by current city)", () => {
  it("holds when the current city matches the intent's city", async () => {
    expect(await locationChecker.holdsToday(KYIV, { now: NOW, city: "Київ" })).toBe(true);
  });

  it("matches case- and whitespace-insensitively", async () => {
    expect(await locationChecker.holdsToday(KYIV, { now: NOW, city: "  київ " })).toBe(true);
  });

  it("does NOT hold when the current city is a different city", async () => {
    expect(await locationChecker.holdsToday(KYIV, { now: NOW, city: "Львів" })).toBe(false);
  });

  it("does NOT hold when the current city is unknown (geo denied/silent)", async () => {
    expect(await locationChecker.holdsToday(KYIV, { now: NOW, city: null })).toBe(false);
    expect(await locationChecker.holdsToday(KYIV, { now: NOW })).toBe(false);
  });
});

describe("locationChecker.isOverdue", () => {
  it("is never overdue — a place has no moment for the clock to pass", async () => {
    expect(await locationChecker.isOverdue(KYIV, { now: NOW, city: "Київ" })).toBe(false);
    expect(await locationChecker.isOverdue(KYIV, { now: NOW, city: "Львів" })).toBe(false);
  });
});

describe("locationChecker async contract", () => {
  it("holdsToday returns a Promise (context passed in from outside)", () => {
    const result = locationChecker.holdsToday(KYIV, { now: NOW, city: "Київ" });
    expect(result).toBeInstanceOf(Promise);
  });
});

// Integration: a city intent must surface in the SAME «Сьогодні» list as time intents,
// recomputed from the current city each time — never a permanent move.
let seq = 0;
function locIntent(city: string): Intent {
  seq += 1;
  return {
    id: `loc${seq}`,
    text: `у ${city}`,
    priority: "medium",
    status: "open",
    condition: { type: "location", value: { city } },
    createdAt: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    todayOverride: null,
    recurring: false,
    duration: null,
  };
}
function timeTodayIntent(): Intent {
  seq += 1;
  return {
    id: `time${seq}`,
    text: "подзвонити",
    priority: "medium",
    status: "open",
    condition: {
      type: "time",
      value: { kind: "date", at: new Date(2026, 0, 5).toISOString(), weekday: null, daypart: null },
    },
    createdAt: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    todayOverride: null,
    recurring: false,
    duration: null,
  };
}

describe("buildToday — city intents surface by presence, not by clock", () => {
  it("surfaces a city intent when the current city matches", async () => {
    const i = locIntent("Київ");
    const { active, overdue } = await buildToday([i], { now: NOW, city: "Київ" });
    expect(active.map((x) => x.id)).toContain(i.id);
    expect(overdue).toHaveLength(0); // never overdue
  });

  it("keeps a city intent out of today when the current city differs", async () => {
    const i = locIntent("Львів");
    const { active, overdue } = await buildToday([i], { now: NOW, city: "Київ" });
    expect(active).toHaveLength(0);
    expect(overdue).toHaveLength(0);
  });

  it("keeps a city intent out of today when geo is silent (no current city)", async () => {
    const i = locIntent("Київ");
    const { active } = await buildToday([i], { now: NOW });
    expect(active).toHaveLength(0);
  });

  it("a city intent sits ALONGSIDE a time intent in the same today list", async () => {
    const loc = locIntent("Київ");
    const time = timeTodayIntent();
    const { active } = await buildToday([loc, time], { now: NOW, city: "Київ" });
    const ids = active.map((x) => x.id);
    expect(ids).toContain(loc.id);
    expect(ids).toContain(time.id);
  });
});
