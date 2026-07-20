// Крок 4 · Ланка 1 — Парсинг: минулий дедлайн → минула ЧАСОВА умова (а не зрізати в none).
// LLM у юніт-тесті не запускаємо — тестуємо КОНТРАКТ промпту (документує минулі маркери й
// вчить віддавати time з минулою датою) + що ВАЛІДАЦІЯ пропускає минулу дату цілою (не none).
// Регрес: теперішні/майбутні маркери в промпті лишились; валідація майбутніх дат не змінена.

import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/parse/prompt";
import { normalizeParseResponse } from "@/lib/parse/normalize";

const TODAY = new Date(2026, 6, 20); // 20 липня 2026

function firstCond(raw: unknown) {
  return normalizeParseResponse(raw, { today: TODAY })[0].condition;
}

describe("SYSTEM_PROMPT — минулий дедлайн (контракт розпізнавання)", () => {
  it("перелічує МИНУЛІ маркери (прострочене → time з минулою датою)", () => {
    expect(SYSTEM_PROMPT).toContain("прострочив");
    expect(SYSTEM_PROMPT).toContain("забув");
    expect(SYSTEM_PROMPT).toContain("треба було");
  });

  it("вчить віддавати саме ЧАСОВУ умову з минулою датою, не none", () => {
    // контракт має явно назвати минулу дату як time, а не безумовність
    expect(SYSTEM_PROMPT).toContain("минул");
    // і не плутати з правилом «нема часу → none»: минуле — це час
    expect(SYSTEM_PROMPT).toMatch(/минул[^.]*time|time[^.]*минул/i);
  });

  it("регрес: теперішні/майбутні маркери лишились у промпті", () => {
    expect(SYSTEM_PROMPT).toContain("завтра");
    expect(SYSTEM_PROMPT).toContain("до п'ятниці");
    expect(SYSTEM_PROMPT).toContain("у понеділок");
  });
});

describe("normalizeParseResponse — минула дата виживає як time", () => {
  it("минула дата (учора) → лишається time, не згортається в none", () => {
    const raw = [
      {
        text: "забути посилку",
        condition: { type: "time", value: { kind: "date", at: "2026-07-19T00:00:00" } },
      },
    ];
    const cond = firstCond(raw);
    expect(cond.type).toBe("time");
    if (cond.type === "time") {
      expect(cond.value.kind).toBe("date");
      expect(cond.value.at).toBe("2026-07-19T00:00:00");
    }
  });

  it("регрес: майбутня дата так само лишається time", () => {
    const raw = [
      {
        text: "купити квитки",
        condition: { type: "time", value: { kind: "date", at: "2026-07-24T00:00:00" } },
      },
    ];
    const cond = firstCond(raw);
    expect(cond.type).toBe("time");
    if (cond.type === "time") expect(cond.value.at).toBe("2026-07-24T00:00:00");
  });
});
