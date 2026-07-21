// Крок 7 · Ланка 1 — Парсинг: розподіл до дедлайну. Та сама модель, що тягне час/пріоритет/гео/
// повтор/тривалість, додатково розпізнає КОНКРЕТНУ годину-межу («N справ до 20:00») і віддає для
// кожної справи транзитне поле `deadline` (ISO з годиною) + condition none — годину дії розставить
// застосунок. LLM у юніт-тесті не запускаємо: тестуємо КОНТРАКТ промпту + що ВАЛІДАЦІЯ приймає
// deadline лише з годиною, а бездатне/безгодинне значення → null. Регрес: наявні поля цілі.

import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/parse/prompt";
import { normalizeParseResponse } from "@/lib/parse/normalize";

const TODAY = new Date(2026, 0, 5);

describe("SYSTEM_PROMPT — дедлайн-розподіл (контракт розпізнавання)", () => {
  it("документує поле deadline у схемі виводу", () => {
    expect(SYSTEM_PROMPT).toContain("deadline");
  });

  it("вчить, що deadline вмикає лише КОНКРЕТНА година-межа", () => {
    expect(SYSTEM_PROMPT).toContain("до 20:00");
    // межа (until), не подія
    expect(SYSTEM_PROMPT).toMatch(/МЕЖА|межа|until/);
  });

  it("розрізняє межу «до [час]» від події «о [час]»", () => {
    expect(SYSTEM_PROMPT).toMatch(/о 20:00|на 20:00/);
  });

  it("вчить давати condition none для розподілюваних справ (годину не вигадувати)", () => {
    expect(SYSTEM_PROMPT).toMatch(/none/);
  });

  it("регрес: наявні маркери часу/гео/повтору лишились", () => {
    expect(SYSTEM_PROMPT).toContain("завтра");
    expect(SYSTEM_PROMPT).toContain("recurring");
    expect(SYSTEM_PROMPT).toContain("duration");
  });
});

describe("normalizeParseResponse — deadline validation", () => {
  it("keeps a deadline that names a concrete hour", () => {
    const raw = [
      { text: "A", condition: { type: "none" }, deadline: "2026-01-05T20:00:00" },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].deadline).toBe("2026-01-05T20:00:00");
  });

  it("rejects a date-only 'deadline' with no hour → null", () => {
    const raw = [{ text: "A", condition: { type: "none" }, deadline: "2026-01-09" }];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].deadline).toBeNull();
  });

  it("defaults deadline to null when absent (ordinary intent, regression)", () => {
    const raw = [
      {
        text: "завтра подзвонити",
        condition: {
          type: "time",
          value: { kind: "datetime", at: "2026-01-06T09:00:00", weekday: null, daypart: null },
        },
      },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].deadline).toBeNull();
    // event time is untouched by the deadline field
    expect(out[0].condition).toEqual({
      type: "time",
      value: { kind: "datetime", at: "2026-01-06T09:00:00", weekday: null, daypart: null },
    });
  });

  it("ignores garbage deadline values → null", () => {
    const raw = [
      { text: "A", condition: { type: "none" }, deadline: 1234 },
      { text: "B", condition: { type: "none" }, deadline: "хтозна" },
    ];
    const out = normalizeParseResponse(raw, { today: TODAY });
    expect(out[0].deadline).toBeNull();
    expect(out[1].deadline).toBeNull();
  });
});
