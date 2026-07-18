import { describe, expect, it } from "vitest";
import {
  ParseFormatError,
  extractJsonArray,
  normalizeParseResponse,
} from "@/lib/parse/normalize";

const TODAY = new Date(2026, 0, 5); // Monday, deterministic

describe("extractJsonArray", () => {
  it("strips ```json fences", () => {
    const raw = '```json\n[{"text":"a"}]\n```';
    expect(extractJsonArray(raw)).toEqual([{ text: "a" }]);
  });
  it("ignores preamble/epilogue around the array", () => {
    const raw = 'Ось наміри: [{"text":"a"}] — готово.';
    expect(extractJsonArray(raw)).toEqual([{ text: "a" }]);
  });
  it("throws ParseFormatError when there is no array", () => {
    expect(() => extractJsonArray("вибач, не зрозумів")).toThrow(ParseFormatError);
  });
  it("throws ParseFormatError on broken JSON", () => {
    expect(() => extractJsonArray("[{text: a}]")).toThrow(ParseFormatError);
  });
});

describe("normalizeParseResponse", () => {
  it("normalizes a fenced, valid response into clean intents", () => {
    const raw =
      '```json\n[{"text":"купити квитки","priority":"high","condition":{"type":"time","value":{"kind":"date","at":"2026-01-05T00:00:00","weekday":null,"daypart":null}}}]\n```';
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("купити квитки");
    expect(out[0].priority).toBe("high");
    expect(out[0].condition.type).toBe("time");
  });

  it("coerces an invalid priority to medium", () => {
    const raw = [{ text: "щось", priority: "urgent", condition: {} }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].priority).toBe("medium");
  });

  it("drops intents without text", () => {
    const raw = [{ text: "", priority: "low" }, { priority: "high" }, { text: "ок" }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("ок");
  });

  it("keeps good intents and drops garbage entries", () => {
    const raw = [null, 42, { text: "лишок" }, "рядок"];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out.map((i) => i.text)).toEqual(["лишок"]);
  });

  it("repairs a dated kind with no valid `at` by defaulting to today", () => {
    const raw = [
      { text: "x", condition: { type: "time", value: { kind: "date", at: "не-дата" } } },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    const v = out[0].condition.type === "time" ? out[0].condition.value : null;
    expect(v?.kind).toBe("date");
    expect(v?.at).toBe(new Date(2026, 0, 5, 0, 0, 0, 0).toISOString());
  });

  it("nullifies an invalid `at` on a weekday kind and keeps the weekday", () => {
    const raw = [
      {
        text: "x",
        condition: { type: "time", value: { kind: "weekday", weekday: "п'ятниця", at: "junk" } },
      },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    const v = out[0].condition.type === "time" ? out[0].condition.value : null;
    expect(v?.kind).toBe("weekday");
    expect(v?.weekday).toBe("п'ятниця");
    expect(v?.at).toBeNull();
  });

  it("always coerces condition.type to time for the core", () => {
    const raw = [{ text: "у Львові кава", condition: { type: "location", value: {} } }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].condition.type).toBe("time");
  });

  it("returns [] for a non-array parsed value", () => {
    expect(normalizeParseResponse({ text: "a" }, { today: TODAY })).toEqual([]);
  });
});
