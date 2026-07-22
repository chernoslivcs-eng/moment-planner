// Крок 7 · Ланка 3 — застосування розподілу. The pure bridge between parsed candidates and the
// distribution engine: candidates carrying a `deadline` cutoff are laid onto concrete `datetime`
// hours BEFORE that cutoff, working around existing committed `datetime` intents (the "occupied"
// hours). Overflow (doesn't fit) is NOT dropped — it stays an unconditional `none` candidate.
// Non-deadline candidates pass through untouched. This runs client-side at commit (where the
// committed intents live), never on the parse server.

import { describe, expect, it } from "vitest";
import { scheduleDeadlineCandidates } from "@/lib/schedule-apply";
import type { Candidate, Intent } from "@/lib/types";

const DAY = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0, 0);
const NAIVE = (h: number, m = 0) =>
  `2026-01-05T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

let seq = 0;
function cand(partial: Partial<Candidate> & { text: string }): Candidate {
  return {
    cid: `c${seq++}`,
    text: partial.text,
    priority: partial.priority ?? "medium",
    recurring: partial.recurring ?? false,
    duration: partial.duration ?? null,
    deadline: partial.deadline ?? null,
    condition: partial.condition ?? { type: "none" },
    pinToday: partial.pinToday,
  };
}

function datetimeIntent(at: string, duration: number | null): Intent {
  return {
    id: `i${seq++}`,
    text: "занято",
    priority: "medium",
    status: "open",
    condition: { type: "time", value: { kind: "datetime", at, weekday: null, daypart: null } },
    createdAt: "2026-01-05T00:00:00",
    recurring: false,
    duration,
  };
}

// Read the assigned hour out of a scheduled candidate.
function hourOf(c: Candidate): string | null {
  if (c.condition.type !== "time" || c.condition.value.kind !== "datetime") return null;
  return c.condition.value.at;
}

describe("scheduleDeadlineCandidates", () => {
  it("passes non-deadline candidates through untouched", () => {
    const a = cand({ text: "купити молоко" });
    const b = cand({ text: "подзвонити", condition: { type: "location", value: { city: "Львів" } } });
    const out = scheduleDeadlineCandidates([a, b], [], DAY(15));
    expect(out).toEqual([a, b]);
  });

  it("lays three deadline tasks (by 20:00, now 15:00) onto 17,18,19 as datetime", () => {
    const tasks = [
      cand({ text: "A", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "B", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "C", duration: 60, deadline: NAIVE(20) }),
    ];
    const out = scheduleDeadlineCandidates(tasks, [], DAY(15));
    expect(out.map(hourOf)).toEqual([NAIVE(17), NAIVE(18), NAIVE(19)]);
    // deadline hint is consumed
    expect(out.every((c) => !c.deadline)).toBe(true);
    // order preserved
    expect(out.map((c) => c.text)).toEqual(["A", "B", "C"]);
  });

  it("works around an existing committed datetime intent at 18:00", () => {
    const tasks = [
      cand({ text: "A", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "B", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "C", duration: 60, deadline: NAIVE(20) }),
    ];
    const occupied = [datetimeIntent(NAIVE(18), 60)];
    const out = scheduleDeadlineCandidates(tasks, occupied, DAY(15));
    // c hugs deadline [19,20); b jumps over 18:00 to 17:00; a sits at 16:00.
    expect(out.map(hourOf)).toEqual([NAIVE(16), NAIVE(17), NAIVE(19)]);
  });

  it("keeps overflow as an unconditional none candidate (not dropped)", () => {
    // now 18:30, deadline 20:00 → only one hour-long task fits.
    const tasks = [
      cand({ text: "A", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "B", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "C", duration: 60, deadline: NAIVE(20) }),
    ];
    const out = scheduleDeadlineCandidates(tasks, [], DAY(18, 30));
    expect(out).toHaveLength(3);
    expect(hourOf(out[2])).toBe(NAIVE(19)); // C placed
    // A and B overflow: remain unconditional, deadline cleared
    expect(out[0].condition.type).toBe("none");
    expect(out[1].condition.type).toBe("none");
    expect(out.every((c) => !c.deadline)).toBe(true);
  });

  it("ignores committed intents that carry no concrete hour (daypart/none) as occupied", () => {
    const daypartIntent: Intent = {
      id: "id",
      text: "ввечері щось",
      priority: "medium",
      status: "open",
      condition: { type: "time", value: { kind: "daypart", at: null, weekday: null, daypart: "evening" } },
      createdAt: "2026-01-05T00:00:00",
      recurring: false,
      duration: 60,
    };
    const tasks = [
      cand({ text: "A", duration: 60, deadline: NAIVE(20) }),
      cand({ text: "B", duration: 60, deadline: NAIVE(20) }),
    ];
    const out = scheduleDeadlineCandidates(tasks, [daypartIntent], DAY(15));
    // daypart "evening" does NOT occupy 19:00 — tasks pack as if it's absent.
    expect(out.map(hourOf)).toEqual([NAIVE(18), NAIVE(19)]);
  });

  it("uses a 60-minute default block for an occupied intent with null duration", () => {
    const tasks = [cand({ text: "A", duration: 60, deadline: NAIVE(20) })];
    const occupied = [datetimeIntent(NAIVE(19), null)]; // blocks [19,20)
    const out = scheduleDeadlineCandidates(tasks, occupied, DAY(15));
    // 19:00 is occupied (default 60) → the task falls back to 18:00.
    expect(hourOf(out[0])).toBe(NAIVE(18));
  });
});

// F2/N3 (аудит): у ОДНОМУ «Підтвердити всі» дзвінок о 21:00 — ще datetime-КАНДИДАТ, не
// закомічений intent. Пакувальник має бачити його як зайнятий слот так само, як committed intent,
// інакше дедлайн-справи лягають ПОВЕРХ дзвінка. Ланцюг DEMO3: дзвінок 21:00 (60хв) + 3 справи по
// 30хв до 23:00.
describe("scheduleDeadlineCandidates — datetime-кандидати того ж пакета як occupied", () => {
  // Non-deadline datetime candidate (e.g. «дзвінок о 21:00») committed in the SAME batch.
  function callCand(at: string, duration: number): Candidate {
    return cand({
      text: "дзвінок",
      duration,
      condition: { type: "time", value: { kind: "datetime", at, weekday: null, daypart: null } },
    });
  }
  // Does a placed task [at, at+dur) overlap the half-open window [winStart, winEnd)?
  function overlapsWindow(at: string | null, durMin: number, winStart: string, winEnd: string): boolean {
    if (!at) return false;
    const s = new Date(at).getTime();
    const e = s + durMin * 60_000;
    const ws = new Date(winStart).getTime();
    const we = new Date(winEnd).getTime();
    return s < we && ws < e;
  }

  it("1) DEMO3 одним пакетом @14:00 — жодна справа не перетинає дзвінок 21:00–22:00", () => {
    const batch = [
      callCand(NAIVE(21), 60),
      cand({ text: "A", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "B", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "C", duration: 30, deadline: NAIVE(23) }),
    ];
    const out = scheduleDeadlineCandidates(batch, [], DAY(14));
    // Call passes through untouched.
    expect(hourOf(out[0])).toBe(NAIVE(21));
    // None of the three tasks overlaps the call's [21:00, 22:00) block.
    for (const c of out.slice(1)) {
      expect(overlapsWindow(hourOf(c), 30, NAIVE(21), NAIVE(22))).toBe(false);
    }
  });

  it("2) DEMO3 одним пакетом @20:30 — три справи у вікні 20:30–23:00, обхід дзвінка, без накладок", () => {
    const batch = [
      callCand(NAIVE(21), 60),
      cand({ text: "A", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "B", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "C", duration: 30, deadline: NAIVE(23) }),
    ];
    const out = scheduleDeadlineCandidates(batch, [], DAY(20, 30));
    // A bumps below the call to 20:30; B/C hug the deadline at 22:00/22:30.
    expect([hourOf(out[1]), hourOf(out[2]), hourOf(out[3])]).toEqual([NAIVE(20, 30), NAIVE(22), NAIVE(22, 30)]);
    for (const c of out.slice(1)) {
      expect(overlapsWindow(hourOf(c), 30, NAIVE(21), NAIVE(22))).toBe(false);
    }
  });

  it("3) контроль: дзвінок закомічено ОКРЕМО раніше — поведінка не змінилась", () => {
    const tasks = [
      cand({ text: "A", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "B", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "C", duration: 30, deadline: NAIVE(23) }),
    ];
    const committedCall = [datetimeIntent(NAIVE(21), 60)];
    const out = scheduleDeadlineCandidates(tasks, committedCall, DAY(20, 30));
    expect(out.map(hourOf)).toEqual([NAIVE(20, 30), NAIVE(22), NAIVE(22, 30)]);
  });

  it("4) регрес: пакет без datetime-кандидата розкладається як було", () => {
    const tasks = [
      cand({ text: "A", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "B", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "C", duration: 30, deadline: NAIVE(23) }),
    ];
    const out = scheduleDeadlineCandidates(tasks, [], DAY(20, 30));
    // No call to avoid → tasks hug the deadline: 21:30 / 22:00 / 22:30.
    expect(out.map(hourOf)).toEqual([NAIVE(21, 30), NAIVE(22), NAIVE(22, 30)]);
  });

  it("5) вузьке вікно @22:15 — overflow у none без крашу", () => {
    const batch = [
      callCand(NAIVE(21), 60),
      cand({ text: "A", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "B", duration: 30, deadline: NAIVE(23) }),
      cand({ text: "C", duration: 30, deadline: NAIVE(23) }),
    ];
    const out = scheduleDeadlineCandidates(batch, [], DAY(22, 15));
    expect(hourOf(out[0])).toBe(NAIVE(21)); // call untouched
    expect(hourOf(out[3])).toBe(NAIVE(22, 30)); // only C fits
    expect(out[1].condition.type).toBe("none"); // A overflow
    expect(out[2].condition.type).toBe("none"); // B overflow
    expect(out.every((c) => !c.deadline)).toBe(true);
  });

  it("6) два datetime-кандидати в одному пакеті — обидва в occupied", () => {
    const batch = [
      callCand(NAIVE(21), 60), // blocks [21,22)
      callCand(NAIVE(19), 60), // blocks [19,20)
      cand({ text: "A", duration: 60, deadline: NAIVE(23) }),
      cand({ text: "B", duration: 60, deadline: NAIVE(23) }),
      cand({ text: "C", duration: 60, deadline: NAIVE(23) }),
      cand({ text: "D", duration: 60, deadline: NAIVE(23) }),
    ];
    const out = scheduleDeadlineCandidates(batch, [], DAY(14));
    for (const c of out.slice(2)) {
      expect(overlapsWindow(hourOf(c), 60, NAIVE(21), NAIVE(22))).toBe(false);
      expect(overlapsWindow(hourOf(c), 60, NAIVE(19), NAIVE(20))).toBe(false);
    }
  });
});
