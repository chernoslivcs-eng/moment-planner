// Ланка 3 — Логіка НЕ-гасіння (серце фічі). Рекурентний ГЕО-намір не гаситься назавжди:
// дія «виконано» (done) до нього не застосовується — він лишається open і виринає знову
// наступного разу в місті. Єдина термінальна дія — «відпустити» (released). Рекурентність
// НЕ додає нового механізму виринання — лише вимикає «завершити-остаточно» для location.
//
// Плюс наскрізне провід: recurring з парсингу доходить до збереженого наміру (candidateToIntent).

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  __resetStoreForTests,
  commitAllCandidates,
  replaceCandidates,
  setIntentStatus,
  useIntents,
} from "@/lib/store";
import type { Intent, ParsedIntent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";

beforeEach(() => {
  localStorage.clear();
  __resetStoreForTests();
});

function seed(intent: Intent) {
  localStorage.setItem(INTENTS_KEY, JSON.stringify([intent]));
  __resetStoreForTests();
}

function baseIntent(over: Partial<Intent>): Intent {
  return {
    id: "i1",
    text: "кава на Каві",
    priority: "low",
    status: "open",
    condition: { type: "location", value: { city: "Львів" } },
    createdAt: "2026-07-01T10:00:00.000Z",
    todayOverride: null,
    recurring: false,
    duration: null,
    ...over,
  };
}

describe("setIntentStatus — не-гасіння рекурентного гео", () => {
  it("location + recurring: «done» НЕ гасить — намір лишається open", async () => {
    seed(baseIntent({ recurring: true }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => setIntentStatus("i1", "done"));
    expect(result.current[0].status).toBe("open");
  });

  it("location + recurring: «released» — єдина термінальна дія, працює", async () => {
    seed(baseIntent({ recurring: true }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => setIntentStatus("i1", "released"));
    expect(result.current[0].status).toBe("released");
  });

  it("регрес: одноразовий ГЕО-намір «done» гаситься як завжди", async () => {
    seed(baseIntent({ recurring: false }));
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => setIntentStatus("i1", "done"));
    expect(result.current[0].status).toBe("done");
  });

  it("захист вузький: recurring на ЧАСОВОМУ намірі не блокує «done»", async () => {
    seed(
      baseIntent({
        recurring: true,
        condition: { type: "time", value: { kind: "date", at: "2026-07-01T00:00:00", weekday: null, daypart: null } },
      }),
    );
    const { result } = renderHook(() => useIntents());
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => setIntentStatus("i1", "done"));
    expect(result.current[0].status).toBe("done");
  });
});

describe("provід recurring: парсинг → збережений намір", () => {
  it("рекурентний кандидат зберігається як recurring intent", () => {
    const parsed: ParsedIntent = {
      text: "кава на Каві",
      priority: "low",
      recurring: true,
      condition: { type: "location", value: { city: "Львів" } },
    };
    replaceCandidates([parsed]);
    commitAllCandidates();

    const saved = JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
    expect(saved).toHaveLength(1);
    expect(saved[0].recurring).toBe(true);
    expect(saved[0].condition.type).toBe("location");
  });

  it("нерекурентний кандидат зберігається з recurring=false", () => {
    const parsed: ParsedIntent = {
      text: "аптека",
      priority: "medium",
      recurring: false,
      condition: { type: "location", value: { city: "Львів" } },
    };
    replaceCandidates([parsed]);
    commitAllCandidates();

    const saved = JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
    expect(saved[0].recurring).toBe(false);
  });
});
