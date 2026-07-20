// Крок 5 · Ланка 1 — Парсинг: оцінка тривалості. Та САМА модель, що тягне час/пріоритет/гео/
// повтор/прострочене, додатково оцінює приблизну тривалість наміру в хвилинах — але не як
// таймтрекер: віддає один із дискретних пресетів {15, 30, 60, 120, null}. Тут тестуємо КОНТРАКТ
// промпту (документує поле duration + пресети + вчить не вигадувати) і що ВАЛІДАЦІЯ приймає лише
// число з набору, а будь-що інше (рядок, від'ємне, поза набором) → null, намір лишається цілим.
// Регрес: наявні правила (час/дата/пріоритет/гео/повтор) нормалізуються так само.

import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/parse/prompt";
import { normalizeParseResponse } from "@/lib/parse/normalize";
import {
  __resetStoreForTests,
  commitAllCandidates,
  replaceCandidates,
} from "@/lib/store";
import type { Intent } from "@/lib/types";

const TODAY = new Date(2026, 6, 20); // 20 липня 2026
const INTENTS_KEY = "mp.intents.v1";

function first(raw: unknown) {
  return normalizeParseResponse(raw, { today: TODAY })[0];
}

describe("SYSTEM_PROMPT — оцінка тривалості (контракт)", () => {
  it("документує поле duration у схемі виводу", () => {
    expect(SYSTEM_PROMPT).toContain("duration");
  });

  it("перелічує дозволені пресети хвилин, не вільне число", () => {
    expect(SYSTEM_PROMPT).toContain("15");
    expect(SYSTEM_PROMPT).toContain("30");
    expect(SYSTEM_PROMPT).toContain("60");
    expect(SYSTEM_PROMPT).toContain("120");
  });

  it("вчить не вигадувати тривалість: неоцінне → null", () => {
    expect(SYSTEM_PROMPT).toMatch(/duration[^.]*null|null[^.]*duration/i);
    expect(SYSTEM_PROMPT).toContain("хвилин");
  });
});

describe("normalizeParseResponse — duration з дозволеного набору або null", () => {
  it("валідний пресет (60) виживає як число", () => {
    const raw = [{ text: "зустріч із командою", condition: { type: "none" }, duration: 60 }];
    expect(first(raw).duration).toBe(60);
  });

  it("усі чотири пресети приймаються", () => {
    for (const preset of [15, 30, 60, 120]) {
      const raw = [{ text: "дія", condition: { type: "none" }, duration: preset }];
      expect(first(raw).duration).toBe(preset);
    }
  });

  it("відсутнє поле → null, намір цілий", () => {
    const raw = [{ text: "купити молоко", condition: { type: "none" } }];
    const intent = first(raw);
    expect(intent.duration).toBeNull();
    expect(intent.text).toBe("купити молоко");
  });

  it("явний null → null", () => {
    const raw = [{ text: "дія", condition: { type: "none" }, duration: null }];
    expect(first(raw).duration).toBeNull();
  });

  it("рядок замість числа → null, намір не губиться", () => {
    const raw = [{ text: "дія", condition: { type: "none" }, duration: "60" }];
    const intent = first(raw);
    expect(intent.duration).toBeNull();
    expect(intent.text).toBe("дія");
  });

  it("від'ємне число → null", () => {
    const raw = [{ text: "дія", condition: { type: "none" }, duration: -30 }];
    expect(first(raw).duration).toBeNull();
  });

  it("число поза набором (45) → null (не таймтрекер)", () => {
    const raw = [{ text: "дія", condition: { type: "none" }, duration: 45 }];
    expect(first(raw).duration).toBeNull();
  });

  it("нуль → null", () => {
    const raw = [{ text: "дія", condition: { type: "none" }, duration: 0 }];
    expect(first(raw).duration).toBeNull();
  });
});

describe("normalizeParseResponse — регрес: наявні поля незмінні", () => {
  it("recurring/time/condition нормалізуються як раніше поряд із duration", () => {
    const raw = [
      {
        text: "кава на Каві",
        priority: "high",
        recurring: true,
        condition: { type: "location", value: { city: "Львів" } },
        duration: 30,
      },
    ];
    const intent = first(raw);
    expect(intent.priority).toBe("high");
    expect(intent.recurring).toBe(true);
    expect(intent.condition).toEqual({ type: "location", value: { city: "Львів" } });
    expect(intent.duration).toBe(30);
  });

  it("часова умова з датою лишається time (duration не ламає)", () => {
    const raw = [
      {
        text: "здати звіт",
        condition: { type: "time", value: { kind: "date", at: "2026-07-24T00:00:00" } },
        duration: 120,
      },
    ];
    const intent = first(raw);
    expect(intent.condition.type).toBe("time");
    if (intent.condition.type === "time") {
      expect(intent.condition.value.at).toBe("2026-07-24T00:00:00");
    }
    expect(intent.duration).toBe(120);
  });
});

describe("candidateToIntent — оцінена тривалість доходить до збереженого наміру", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStoreForTests();
  });

  it("кандидат із duration=60 → збережений намір несе duration=60 (не обнуляється)", () => {
    const [candidate] = normalizeParseResponse(
      [{ text: "зустріч", condition: { type: "none" }, duration: 60 }],
      { today: TODAY },
    );
    replaceCandidates([candidate]);
    commitAllCandidates();

    const saved = JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(60);
  });

  it("кандидат без тривалості → збережений намір несе duration=null", () => {
    const [candidate] = normalizeParseResponse(
      [{ text: "купити молоко", condition: { type: "none" } }],
      { today: TODAY },
    );
    replaceCandidates([candidate]);
    commitAllCandidates();

    const saved = JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
    expect(saved[0].duration).toBeNull();
  });
});
