import { describe, expect, it } from "vitest";
import { localCalendarDate, resolveTodayISODate } from "@/lib/dates";

// Regression guard for the "нічний зсув дати" bug.
//
// Symptom (live only 00:00–03:00 Kyiv, when Kyiv and UTC sit on different calendar dates):
// dictating «сьогодні …» at 00:17 Kyiv parsed onto YESTERDAY. Root cause: the client sent
// `new Date().toISOString()` (a UTC instant) as its "today", and the server sliced a UTC date
// off it — so at 00:17 Kyiv (= 21:17 UTC of the prior day) Haiku was told "today = yesterday".
//
// Fix contract: the client sends its LOCAL calendar date (YYYY-MM-DD); the server uses that
// date STRING directly for the prompt, doing no further timezone conversion. These tests pin
// the contract machine-timezone-INDEPENDENTLY by building Dates with the LOCAL constructor and
// reading them with LOCAL getters — the same zone the browser would use.

describe("localCalendarDate — the browser's wall-calendar day, no UTC round-trip", () => {
  it("returns the LOCAL Y-M-D just after midnight (00:17), not the UTC-shifted prior day", () => {
    // Local July 22, 00:17 in whatever zone the test host runs in. The OLD code's
    // `new Date().toISOString()` would, on a UTC+ box, roll this back to July 21.
    const justAfterMidnight = new Date(2026, 6, 22, 0, 17, 0);
    expect(localCalendarDate(justAfterMidnight)).toBe("2026-07-22");
  });

  it("returns the same Y-M-D during the day (15:00) — daytime behaviour is unchanged", () => {
    const midAfternoon = new Date(2026, 6, 22, 15, 0, 0);
    expect(localCalendarDate(midAfternoon)).toBe("2026-07-22");
  });

  it("zero-pads month and day", () => {
    expect(localCalendarDate(new Date(2026, 0, 5, 9, 0, 0))).toBe("2026-01-05");
  });
});

describe("resolveTodayISODate — server trusts the client's local date string verbatim", () => {
  it("uses a plain YYYY-MM-DD from the client directly (no re-conversion)", () => {
    expect(resolveTodayISODate("2026-07-22")).toBe("2026-07-22");
  });

  it("night bug: local date 2026-07-22 resolves to 22nd, NOT the UTC-shifted 21st", () => {
    // What the fixed client sends at 00:17 Kyiv is its LOCAL date string.
    const clientLocalDate = localCalendarDate(new Date(2026, 6, 22, 0, 17, 0));
    expect(clientLocalDate).toBe("2026-07-22");
    expect(resolveTodayISODate(clientLocalDate)).toBe("2026-07-22");
  });

  it("documents the OLD bug fingerprint: a UTC instant slices to yesterday", () => {
    // The pre-fix path: client sent an absolute instant, server sliced a UTC date off it.
    // 00:17 Kyiv (UTC+3) == 21:17 UTC of July 21. This assertion is machine-independent
    // because the instant carries an explicit Z.
    const oldClientPayload = "2026-07-21T21:17:00.000Z";
    const buggyDate = new Date(oldClientPayload).toISOString().slice(0, 10);
    expect(buggyDate).toBe("2026-07-21"); // ← the bug: "today" became yesterday
  });

  it("falls back to the server's local date when the body carries no usable date", () => {
    const now = new Date(2026, 6, 22, 15, 0, 0);
    expect(resolveTodayISODate(undefined, now)).toBe("2026-07-22");
    expect(resolveTodayISODate("", now)).toBe("2026-07-22");
    expect(resolveTodayISODate(12345, now)).toBe("2026-07-22");
  });
});
