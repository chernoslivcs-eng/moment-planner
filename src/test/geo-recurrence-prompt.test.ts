// Ланка 1 — Парсинг: промпт Haiku має вчити розпізнавати ПОВТОРюваний гео-намір.
// LLM у юніт-тесті не запускаємо — тестуємо КОНТРАКТ промпту: що він документує поле
// `recurring` у схемі виводу, маркери повтору (виставляють true) і одноразові маркери
// (лишають false), та явний дефолт false за неоднозначності.

import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/parse/prompt";

describe("SYSTEM_PROMPT — гео-рекурентність (контракт розпізнавання)", () => {
  it("документує поле recurring у схемі виводу", () => {
    expect(SYSTEM_PROMPT).toContain("recurring");
  });

  it("перелічує маркери ПОВТОРУ (виставляють recurring: true)", () => {
    // достатньо кількох канонічних маркерів із контракту
    expect(SYSTEM_PROMPT).toContain("щоразу");
    expect(SYSTEM_PROMPT).toContain("кожного разу");
    expect(SYSTEM_PROMPT).toContain("коли буваю");
  });

  it("перелічує ОДНОРАЗОВІ маркери (лишають recurring: false)", () => {
    expect(SYSTEM_PROMPT).toContain("коли буду");
    expect(SYSTEM_PROMPT).toContain("коли поїду");
  });

  it("фіксує дефолт false за неоднозначності", () => {
    expect(SYSTEM_PROMPT).toContain("false");
  });
});
