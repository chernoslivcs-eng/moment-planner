// Ланка 2 — Валідація /api/parse (через normalizeParseResponse): схема ПРИЙМАЄ `recurring`.
// Моделі не вірити на слово: є валідний boolean → зберегти; немає або кривий тип → false,
// але сам намір ЛИШИТИ цілим (не відкидати). Часові/безумовні наміри дефолтяться у false.

import { describe, expect, it } from "vitest";
import { normalizeParseResponse } from "@/lib/parse/normalize";

const TODAY = new Date(2026, 0, 5);

function firstOf(raw: unknown) {
  return normalizeParseResponse(raw, { today: TODAY })[0];
}

describe("normalizeParseResponse — recurring (валідація)", () => {
  it("зберігає recurring: true на гео-намірі (маркер повтору розпізнано)", () => {
    const raw = [
      {
        text: "зайти в каву на Каві",
        recurring: true,
        condition: { type: "location", value: { city: "Львів" } },
      },
    ];
    expect(firstOf(raw).recurring).toBe(true);
  });

  it("зберігає recurring: false, коли модель явно так сказала", () => {
    const raw = [
      {
        text: "зайти в аптеку",
        recurring: false,
        condition: { type: "location", value: { city: "Львів" } },
      },
    ];
    expect(firstOf(raw).recurring).toBe(false);
  });

  it("відсутній recurring → false (дефолт), намір цілий", () => {
    const raw = [
      { text: "купити квитки", condition: { type: "location", value: { city: "Київ" } } },
    ];
    const out = firstOf(raw);
    expect(out.recurring).toBe(false);
    // намір не відкинуто — усі поля на місці
    expect(out.text).toBe("купити квитки");
    expect(out.condition.type).toBe("location");
  });

  it("кривий тип recurring (рядок) → false, намір цілий", () => {
    const raw = [
      {
        text: "аптека",
        recurring: "true",
        condition: { type: "location", value: { city: "Одеса" } },
      },
    ];
    const out = firstOf(raw);
    expect(out.recurring).toBe(false);
    expect(out.text).toBe("аптека");
    expect(out.condition.type).toBe("location");
  });

  it("кривий тип recurring (число) → false", () => {
    const raw = [
      { text: "кава", recurring: 1, condition: { type: "location", value: { city: "Київ" } } },
    ];
    expect(firstOf(raw).recurring).toBe(false);
  });

  it("часовий намір дефолтиться у recurring: false", () => {
    const raw = [
      {
        text: "подзвонити",
        condition: { type: "time", value: { kind: "date", at: "2026-01-06T00:00:00" } },
      },
    ];
    expect(firstOf(raw).recurring).toBe(false);
  });

  it("безумовний намір дефолтиться у recurring: false", () => {
    const raw = [{ text: "купити молоко", condition: { type: "none" } }];
    expect(firstOf(raw).recurring).toBe(false);
  });
});
