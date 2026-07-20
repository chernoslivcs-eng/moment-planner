// Крок 6 · Ланка 1 — Модель операції (мутація, не нове поле). updateIntent(id, patch) оновлює
// НАЯВНИЙ намір за id, приймаючи часткові зміни будь-яких з полів text/priority/condition/
// recurring/duration. Валідація — як при створенні: priority з дозволених, condition поліморфно
// коректна, duration з пресетів або null, text непорожній. Криве значення → відкинуто (лишається
// як було), намір не псується. Статус (open/done/released) редагування НЕ чіпає — людські рішення
// живуть окремо. Невідомий id → no-op. Мутація персиститься й тригерить emit (перерахунок Today).

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  __resetStoreForTests,
  updateIntent,
  useIntents,
} from "@/lib/store";
import type { Condition, Intent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";

const TIME_TODAY: Condition = {
  type: "time",
  value: { kind: "date", at: "2026-07-20T00:00:00", weekday: null, daypart: null },
};
const GEO: Condition = { type: "location", value: { city: "Львів" } };
const NONE: Condition = { type: "none" };

function baseIntent(over: Partial<Intent> & { id: string }): Intent {
  return {
    text: "зустріч",
    priority: "medium",
    status: "open",
    condition: NONE,
    createdAt: "2026-07-01T10:00:00.000Z",
    todayOverride: null,
    recurring: false,
    duration: null,
    ...over,
  };
}

function seed(intents: Intent[]) {
  localStorage.setItem(INTENTS_KEY, JSON.stringify(intents));
  __resetStoreForTests();
}

function saved(): Intent[] {
  return JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
}

beforeEach(() => {
  localStorage.clear();
  __resetStoreForTests();
});

describe("updateIntent — мутація кожного поля окремо, решта ціла", () => {
  it("оновлює text, не чіпаючи інші поля", () => {
    seed([baseIntent({ id: "i1", priority: "high", duration: 60, condition: GEO })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { text: "новий текст" }));
    const i = result.current[0];
    expect(i.text).toBe("новий текст");
    expect(i.priority).toBe("high");
    expect(i.duration).toBe(60);
    expect(i.condition).toEqual(GEO);
  });

  it("оновлює priority", () => {
    seed([baseIntent({ id: "i1", priority: "low" })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { priority: "high" }));
    expect(result.current[0].priority).toBe("high");
  });

  it("оновлює condition (none → time)", () => {
    seed([baseIntent({ id: "i1", condition: NONE })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { condition: TIME_TODAY }));
    expect(result.current[0].condition).toEqual(TIME_TODAY);
  });

  it("оновлює recurring", () => {
    seed([baseIntent({ id: "i1", condition: GEO, recurring: false })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { recurring: true }));
    expect(result.current[0].recurring).toBe(true);
  });

  it("оновлює duration (пресет)", () => {
    seed([baseIntent({ id: "i1", duration: null })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { duration: 30 }));
    expect(result.current[0].duration).toBe(30);
  });

  it("скидає duration у null", () => {
    seed([baseIntent({ id: "i1", duration: 120 })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { duration: null }));
    expect(result.current[0].duration).toBeNull();
  });

  it("кілька полів за один виклик", () => {
    seed([baseIntent({ id: "i1" })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { text: "кава", priority: "low", condition: GEO, duration: 15 }));
    const i = result.current[0];
    expect(i.text).toBe("кава");
    expect(i.priority).toBe("low");
    expect(i.condition).toEqual(GEO);
    expect(i.duration).toBe(15);
  });
});

describe("updateIntent — статус недоторканний редагуванням", () => {
  it("done лишається done після зміни тексту", () => {
    seed([baseIntent({ id: "i1", status: "done" })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { text: "змінено" }));
    expect(result.current[0].status).toBe("done");
    expect(result.current[0].text).toBe("змінено");
  });

  it("released лишається released після зміни condition", () => {
    seed([baseIntent({ id: "i1", status: "released" })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { condition: GEO }));
    expect(result.current[0].status).toBe("released");
  });

  it("patch зі status ігнорується (не проходить у намір)", () => {
    seed([baseIntent({ id: "i1", status: "open" })]);
    const { result } = renderHook(() => useIntents());
    // @ts-expect-error — status не входить у IntentEdit; навіть якщо просочиться, ігнорується
    act(() => updateIntent("i1", { status: "done" }));
    expect(result.current[0].status).toBe("open");
  });
});

describe("updateIntent — валідація: криве відкинуто, намір не зіпсутий", () => {
  it("порожній/пробільний text відкинуто (лишається старий)", () => {
    seed([baseIntent({ id: "i1", text: "оригінал" })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { text: "   " }));
    expect(result.current[0].text).toBe("оригінал");
  });

  it("криве priority відкинуто", () => {
    seed([baseIntent({ id: "i1", priority: "high" })]);
    const { result } = renderHook(() => useIntents());
    // @ts-expect-error — навмисне криве значення
    act(() => updateIntent("i1", { priority: "urgent" }));
    expect(result.current[0].priority).toBe("high");
  });

  it("duration поза пресетами (45) відкинуто", () => {
    seed([baseIntent({ id: "i1", duration: 60 })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { duration: 45 }));
    expect(result.current[0].duration).toBe(60);
  });

  it("крива condition відкинута (лишається стара)", () => {
    seed([baseIntent({ id: "i1", condition: GEO })]);
    const { result } = renderHook(() => useIntents());
    // @ts-expect-error — навмисне крива форма condition
    act(() => updateIntent("i1", { condition: { type: "weather" } }));
    expect(result.current[0].condition).toEqual(GEO);
  });

  it("location без міста відкинуто", () => {
    seed([baseIntent({ id: "i1", condition: GEO })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { condition: { type: "location", value: { city: "  " } } }));
    expect(result.current[0].condition).toEqual(GEO);
  });
});

describe("updateIntent — межі та наскрізність", () => {
  it("невідомий id → no-op, нічого не змінюється", () => {
    seed([baseIntent({ id: "i1", text: "цілий" })]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("nope", { text: "хтозна" }));
    expect(result.current[0].text).toBe("цілий");
  });

  it("інші наміри не зачеплені", () => {
    seed([
      baseIntent({ id: "i1", text: "перший" }),
      baseIntent({ id: "i2", text: "другий" }),
    ]);
    const { result } = renderHook(() => useIntents());
    act(() => updateIntent("i1", { text: "змінений" }));
    const byId = Object.fromEntries(result.current.map((i) => [i.id, i.text]));
    expect(byId.i1).toBe("змінений");
    expect(byId.i2).toBe("другий");
  });

  it("зміна персиститься у localStorage", () => {
    seed([baseIntent({ id: "i1" })]);
    renderHook(() => useIntents());
    act(() => updateIntent("i1", { text: "збережено", duration: 30 }));
    const s = saved();
    expect(s[0].text).toBe("збережено");
    expect(s[0].duration).toBe(30);
  });
});
