// Крок 6 · Ланка 3 — Переміщення після збереження. Зміна УМОВИ збереженого наміру через
// updateIntent → наступний перерахунок buildToday сам перекласифіковує намір у потрібну секцію
// (жодного окремого механізму: emit() у сторі тригерить перерахунок, який сторінки вже роблять на
// зміну intents). Тут доводимо це на рівні стор+логіка: після мутації той самий масив намірів,
// прогнаний крізь buildToday, дає нову належність. Кейси з контракту: час «сьогодні»→«завтра»
// (зникає з «Сьогодні», чекає у «Заплановано»), без-умови→гео (їде у «Заплановано»/«Місце»,
// поки не в місті), гео + додати повтор (стає рекурентним — лише «відпустити»).

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  __resetStoreForTests,
  setIntentStatus,
  updateIntent,
  useIntents,
} from "@/lib/store";
import { buildToday } from "@/lib/today";
import type { ConditionContext } from "@/lib/conditions/context";
import type { Condition, Intent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";
const NOW = new Date(2026, 6, 20, 9, 0, 0); // 20 липня 2026, ранок

function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}T00:00:00`;
}

const TODAY: Condition = {
  type: "time",
  value: { kind: "date", at: localDateISO(NOW), weekday: null, daypart: null },
};
const TOMORROW: Condition = {
  type: "time",
  value: { kind: "date", at: localDateISO(new Date(2026, 6, 21)), weekday: null, daypart: null },
};
const GEO_LVIV: Condition = { type: "location", value: { city: "Львів" } };
const NONE: Condition = { type: "none" };

function ctx(city?: string | null): ConditionContext {
  return { now: NOW, city };
}

function baseIntent(over: Partial<Intent> & { id: string }): Intent {
  return {
    text: "намір",
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

function seed(intent: Intent) {
  localStorage.setItem(INTENTS_KEY, JSON.stringify([intent]));
  __resetStoreForTests();
}

// Whether an intent id is surfaced today (either the active plan or overdue) — i.e. lives on «Сьогодні».
function inToday(view: { active: Intent[]; overdue: Intent[] }, id: string): boolean {
  return [...view.active, ...view.overdue].some((i) => i.id === id);
}

// «Заплановано» membership: an open intent buildToday leaves unsurfaced (same rule the page uses).
function isWaiting(intents: Intent[], view: { active: Intent[]; overdue: Intent[] }, id: string): boolean {
  const i = intents.find((x) => x.id === id);
  return !!i && i.status === "open" && !inToday(view, id);
}

beforeEach(() => {
  localStorage.clear();
  __resetStoreForTests();
});

describe("Ланка 3 — зміна умови переміщує намір між екранами", () => {
  it("час «сьогодні» → «завтра»: зникає з «Сьогодні», чекає у «Заплановано»", async () => {
    seed(baseIntent({ id: "i1", condition: TODAY }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    // до правки — у «Сьогодні»
    let view = await buildToday(result.current, ctx());
    expect(inToday(view, "i1")).toBe(true);

    // правимо умову на «завтра»
    act(() => updateIntent("i1", { condition: TOMORROW }));

    // після — зникло з «Сьогодні», але тихо чекає у «Заплановано»
    view = await buildToday(result.current, ctx());
    expect(inToday(view, "i1")).toBe(false);
    expect(isWaiting(result.current, view, "i1")).toBe(true);
  });

  it("без умови → гео: їде з «Сьогодні» у «Заплановано»/«Місце» (поки не в місті)", async () => {
    seed(baseIntent({ id: "i1", condition: NONE }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    // безумовний — у «Сьогодні»
    let view = await buildToday(result.current, ctx());
    expect(inToday(view, "i1")).toBe(true);

    act(() => updateIntent("i1", { condition: GEO_LVIV }));

    // не у Львові → не виринає в «Сьогодні», чекає на осі «Місце»
    view = await buildToday(result.current, ctx("Одеса"));
    expect(inToday(view, "i1")).toBe(false);
    expect(isWaiting(result.current, view, "i1")).toBe(true);
    expect(result.current[0].condition.type).toBe("location");
  });

  it("той самий гео-намір виринає в «Сьогодні», коли ти в тому місті", async () => {
    seed(baseIntent({ id: "i1", condition: NONE }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => updateIntent("i1", { condition: GEO_LVIV }));
    const view = await buildToday(result.current, ctx("Львів"));
    expect(inToday(view, "i1")).toBe(true);
  });

  it("гео + додати повтор → рекурентний: «done» більше не гасить (лише «відпустити»)", async () => {
    seed(baseIntent({ id: "i1", condition: GEO_LVIV, recurring: false }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => updateIntent("i1", { recurring: true }));
    expect(result.current[0].recurring).toBe(true);
    expect(result.current[0].condition.type).toBe("location");

    // рекурентний гео: «done» НЕ гасить — лишається open (виринатиме знову в місті)
    act(() => setIntentStatus("i1", "done"));
    expect(result.current[0].status).toBe("open");

    // «released» — єдина термінальна дія
    act(() => setIntentStatus("i1", "released"));
    expect(result.current[0].status).toBe("released");
  });

  it("регрес: правка НЕ-умовного поля (текст) не рухає намір із «Сьогодні»", async () => {
    seed(baseIntent({ id: "i1", condition: TODAY }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => updateIntent("i1", { text: "інший текст" }));
    const view = await buildToday(result.current, ctx());
    expect(inToday(view, "i1")).toBe(true);
    expect(result.current[0].text).toBe("інший текст");
  });
});
