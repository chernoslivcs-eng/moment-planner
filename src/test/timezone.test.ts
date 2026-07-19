import { describe, expect, it } from "vitest";
import { normalizeParseResponse } from "@/lib/parse/normalize";
import { describeCondition } from "@/lib/format";
import type { Condition } from "@/lib/types";

// Regression guard for the "о 18-ій поплавати → 21:00" bug.
//
// The model returns a naive wall time ("2026-07-19T18:00:00", no offset) — exactly what the
// user said. The bug lived in the round-trip AROUND it:
//   • normalize did `new Date(s).toISOString()`, freezing the naive string to the SERVER's
//     timezone and re-emitting UTC. On Vercel (UTC) "18:00" became 18:00Z.
//   • render did `new Date(at)` + browser-local Intl, re-reading that instant in the BROWSER's
//     zone. A Kyiv browser (UTC+3) showed 18:00Z as 21:00.
// It was invisible on a Kyiv dev box because server and browser shared the zone and the two
// shifts cancelled. So a single-timezone test cannot see it — we pin BOTH halves instead.

const RAW_MODEL = [
  {
    text: "поплавати",
    priority: "medium",
    condition: {
      type: "time",
      value: { kind: "datetime", at: "2026-07-19T18:00:00", weekday: null, daypart: null },
    },
  },
];

// Fixed "now" on a later day so the date label is stable ("19 липня"), never "Сьогодні".
const NOW = new Date(2026, 6, 20);

function atOf(c: Condition): string | null {
  return c.type === "time" && "at" in c.value ? c.value.at : null;
}

describe("wall-clock time is zone-neutral end to end (о 18-ій → 18:00, not 21:00)", () => {
  it("normalize stores the wall time with NO timezone marker — the server's zone can't shift it", () => {
    // This is the SERVER half, and it is machine-timezone-INDEPENDENT: the old code always
    // emitted a trailing "Z" (via toISOString), so this assertion is red on the old
    // implementation and green on the new one no matter where the test runs.
    const [intent] = normalizeParseResponse(RAW_MODEL);
    const at = atOf(intent.condition);
    expect(at).toBe("2026-07-19T18:00:00"); // literal wall time, byte-for-byte
    expect(at).not.toMatch(/Z$|[+-]\d\d:?\d\d$/); // no UTC/offset baked in — the bug's fingerprint
  });

  it("render shows 18:00, not 21:00, for the value a UTC server persisted", () => {
    // The RENDER half. This value is exactly what the old UTC (Vercel) server used to store —
    // an absolute instant. On this Kyiv dev machine (UTC+3) the old render turned it into
    // "21:00"; the fixed render pins the wall hour to UTC and shows "18:00" on any machine.
    const legacy: Condition = {
      type: "time",
      value: { kind: "datetime", at: "2026-07-19T18:00:00.000Z", weekday: null, daypart: null },
    };
    const shown = describeCondition(legacy, NOW);
    expect(shown).toContain("18:00");
    expect(shown).not.toContain("21:00");
  });

  it("full pipeline: raw model 18:00 → normalize → render stays 18:00", () => {
    const [intent] = normalizeParseResponse(RAW_MODEL);
    const shown = describeCondition(intent.condition, NOW);
    expect(shown).toContain("18:00");
    expect(shown).not.toContain("21:00");
  });
});
