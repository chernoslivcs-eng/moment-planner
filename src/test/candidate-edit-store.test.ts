// Крок 6 · Ланка 4 — Той самий редактор і в Розборі. updateCandidate(cid, patch) — дзеркало
// updateIntent, але над буфером кандидатів (Candidate[], ключ cid). Приймає той самий IntentEdit
// (text/priority/condition/recurring/duration) з тією ж валідацією: priority з дозволених, condition
// поліморфно коректна, duration з пресетів або null, text непорожній; криве значення → відкинуто
// (кандидат лишається як був). Ідентичність/рішення кандидата (cid, pinToday) редагування НЕ чіпає —
// аналог того, що редагування не чіпає status у наміра. Невідомий cid → no-op. Мутація персиститься
// й тригерить emit (перерахунок Розбору). setCandidateDuration стає окремим випадком цієї межі.

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  __resetStoreForTests,
  updateCandidate,
  useCandidates,
} from "@/lib/store";
import type { Candidate, Condition } from "@/lib/types";

const CANDIDATES_KEY = "mp.candidates.v1";

const TIME_TODAY: Condition = {
  type: "time",
  value: { kind: "date", at: "2026-07-20T00:00:00", weekday: null, daypart: null },
};
const GEO: Condition = { type: "location", value: { city: "Львів" } };
const NONE: Condition = { type: "none" };

function baseCandidate(over: Partial<Candidate> & { cid: string }): Candidate {
  return {
    text: "зустріч",
    priority: "medium",
    recurring: false,
    condition: NONE,
    duration: null,
    ...over,
  };
}

function seed(candidates: Candidate[]) {
  localStorage.setItem(CANDIDATES_KEY, JSON.stringify(candidates));
  __resetStoreForTests();
}

function saved(): Candidate[] {
  return JSON.parse(localStorage.getItem(CANDIDATES_KEY) ?? "[]") as Candidate[];
}

beforeEach(() => {
  localStorage.clear();
  __resetStoreForTests();
});

describe("updateCandidate — мутація кожного поля окремо, решта ціла", () => {
  it("оновлює text, не чіпаючи інші поля", () => {
    seed([baseCandidate({ cid: "c1", priority: "high", duration: 60, condition: GEO })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { text: "новий текст" }));
    const c = result.current[0];
    expect(c.text).toBe("новий текст");
    expect(c.priority).toBe("high");
    expect(c.duration).toBe(60);
    expect(c.condition).toEqual(GEO);
  });

  it("оновлює priority", () => {
    seed([baseCandidate({ cid: "c1", priority: "low" })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { priority: "high" }));
    expect(result.current[0].priority).toBe("high");
  });

  it("оновлює condition (none → time)", () => {
    seed([baseCandidate({ cid: "c1", condition: NONE })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { condition: TIME_TODAY }));
    expect(result.current[0].condition).toEqual(TIME_TODAY);
  });

  it("оновлює recurring", () => {
    seed([baseCandidate({ cid: "c1", condition: GEO, recurring: false })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { recurring: true }));
    expect(result.current[0].recurring).toBe(true);
  });

  it("оновлює duration (пресет)", () => {
    seed([baseCandidate({ cid: "c1", duration: null })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { duration: 30 }));
    expect(result.current[0].duration).toBe(30);
  });

  it("скидає duration у null", () => {
    seed([baseCandidate({ cid: "c1", duration: 120 })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { duration: null }));
    expect(result.current[0].duration).toBeNull();
  });

  it("кілька полів за один виклик", () => {
    seed([baseCandidate({ cid: "c1" })]);
    const { result } = renderHook(() => useCandidates());
    act(() =>
      updateCandidate("c1", { text: "кава", priority: "low", condition: GEO, duration: 15 }),
    );
    const c = result.current[0];
    expect(c.text).toBe("кава");
    expect(c.priority).toBe("low");
    expect(c.condition).toEqual(GEO);
    expect(c.duration).toBe(15);
  });
});

describe("updateCandidate — ідентичність/рішення недоторканні (cid, pinToday)", () => {
  it("pinToday лишається після зміни тексту", () => {
    seed([baseCandidate({ cid: "c1", pinToday: true })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { text: "змінено" }));
    expect(result.current[0].pinToday).toBe(true);
    expect(result.current[0].text).toBe("змінено");
  });

  it("cid лишається після зміни condition", () => {
    seed([baseCandidate({ cid: "c1" })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { condition: GEO }));
    expect(result.current[0].cid).toBe("c1");
  });

  it("patch із pinToday ігнорується (не входить у IntentEdit)", () => {
    seed([baseCandidate({ cid: "c1", pinToday: false })]);
    const { result } = renderHook(() => useCandidates());
    // @ts-expect-error — pinToday не входить у IntentEdit; навіть якщо просочиться, ігнорується
    act(() => updateCandidate("c1", { pinToday: true }));
    expect(result.current[0].pinToday).toBe(false);
  });
});

describe("updateCandidate — валідація: криве відкинуто, кандидат не зіпсутий", () => {
  it("порожній/пробільний text відкинуто (лишається старий)", () => {
    seed([baseCandidate({ cid: "c1", text: "оригінал" })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { text: "   " }));
    expect(result.current[0].text).toBe("оригінал");
  });

  it("криве priority відкинуто", () => {
    seed([baseCandidate({ cid: "c1", priority: "high" })]);
    const { result } = renderHook(() => useCandidates());
    // @ts-expect-error — навмисне криве значення
    act(() => updateCandidate("c1", { priority: "urgent" }));
    expect(result.current[0].priority).toBe("high");
  });

  it("duration поза пресетами (45) відкинуто", () => {
    seed([baseCandidate({ cid: "c1", duration: 60 })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { duration: 45 }));
    expect(result.current[0].duration).toBe(60);
  });

  it("крива condition відкинута (лишається стара)", () => {
    seed([baseCandidate({ cid: "c1", condition: GEO })]);
    const { result } = renderHook(() => useCandidates());
    // @ts-expect-error — навмисне крива форма condition
    act(() => updateCandidate("c1", { condition: { type: "weather" } }));
    expect(result.current[0].condition).toEqual(GEO);
  });

  it("location без міста відкинуто", () => {
    seed([baseCandidate({ cid: "c1", condition: GEO })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { condition: { type: "location", value: { city: "  " } } }));
    expect(result.current[0].condition).toEqual(GEO);
  });
});

describe("updateCandidate — межі та наскрізність", () => {
  it("невідомий cid → no-op, нічого не змінюється", () => {
    seed([baseCandidate({ cid: "c1", text: "цілий" })]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("nope", { text: "хтозна" }));
    expect(result.current[0].text).toBe("цілий");
  });

  it("інші кандидати не зачеплені", () => {
    seed([
      baseCandidate({ cid: "c1", text: "перший" }),
      baseCandidate({ cid: "c2", text: "другий" }),
    ]);
    const { result } = renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { text: "змінений" }));
    const byCid = Object.fromEntries(result.current.map((c) => [c.cid, c.text]));
    expect(byCid.c1).toBe("змінений");
    expect(byCid.c2).toBe("другий");
  });

  it("зміна персиститься у localStorage", () => {
    seed([baseCandidate({ cid: "c1" })]);
    renderHook(() => useCandidates());
    act(() => updateCandidate("c1", { text: "збережено", duration: 30 }));
    const s = saved();
    expect(s[0].text).toBe("збережено");
    expect(s[0].duration).toBe(30);
  });
});
