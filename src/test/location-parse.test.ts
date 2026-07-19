import { describe, expect, it } from "vitest";
import { normalizeParseResponse } from "@/lib/parse/normalize";
import { describeCondition } from "@/lib/format";
import type { CityValue } from "@/lib/types";

const TODAY = new Date(2026, 0, 5); // Monday, deterministic

// The city the AI already resolved to nominative comes back on condition.value.city.
function cityOf(raw: unknown): string | null {
  const out = normalizeParseResponse(raw, { today: TODAY });
  const c = out[0]?.condition;
  return c && c.type === "location" ? c.value.city : null;
}

describe("normalizeParseResponse — location (city) condition", () => {
  it("keeps a location condition carrying a city", () => {
    const raw = [
      { text: "зайти в аптеку", condition: { type: "location", value: { city: "Львів" } } },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("location");
    expect(cityOf(raw)).toBe("Львів");
  });

  it("trims surrounding whitespace on the city name", () => {
    const raw = [
      { text: "кава", condition: { type: "location", value: { city: "  Одеса  " } } },
    ];
    expect(cityOf(raw)).toBe("Одеса");
  });

  it("carries ONLY the city — no coordinates or radius leak into the value", () => {
    const raw = [
      { text: "аптека", condition: { type: "location", value: { city: "Київ" } } },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    const value = out[0].condition.type === "location" ? out[0].condition.value : null;
    // Exact shape: CityValue is { city } and nothing else.
    expect(value).toEqual({ city: "Київ" } satisfies CityValue);
  });
});

describe("normalizeParseResponse — soft fallback for a broken location", () => {
  it("location with no value → none (no garbage stored)", () => {
    const raw = [{ text: "у місті кава", condition: { type: "location" } }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("none");
  });

  it("location with an empty city → none", () => {
    const raw = [{ text: "кава", condition: { type: "location", value: { city: "" } } }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("none");
  });

  it("location with a whitespace-only city → none", () => {
    const raw = [{ text: "кава", condition: { type: "location", value: { city: "   " } } }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("none");
  });

  it("location with a non-string city → none", () => {
    const raw = [{ text: "кава", condition: { type: "location", value: { city: 42 } } }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("none");
  });
});

// The heart of step 3: the three condition kinds must never be confused for one another.
describe("condition discrimination — time vs location vs none", () => {
  it("«коли буду у Львові...» → location(Львів)", () => {
    const raw = [
      { text: "зайти в аптеку", condition: { type: "location", value: { city: "Львів" } } },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("location");
  });

  it("«завтра подзвонити» → time", () => {
    const raw = [
      {
        text: "подзвонити",
        condition: { type: "time", value: { kind: "date", at: "2026-01-06T00:00:00" } },
      },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("time");
  });

  it("«купити молоко» → none", () => {
    const raw = [{ text: "купити молоко", condition: { type: "none" } }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("none");
  });

  it("a mixed stream keeps each condition on its own track", () => {
    const raw = [
      { text: "зайти в аптеку", condition: { type: "location", value: { city: "Львів" } } },
      {
        text: "подзвонити",
        condition: { type: "time", value: { kind: "date", at: "2026-01-06T00:00:00" } },
      },
      { text: "купити молоко", condition: { type: "none" } },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out.map((i) => i.condition.type)).toEqual(["location", "time", "none"]);
  });
});

describe("describeCondition — location chip", () => {
  it("renders the city name for a location condition", () => {
    const shown = describeCondition(
      { type: "location", value: { city: "Львів" } },
      TODAY,
    );
    expect(shown).toContain("Львів");
  });
});
