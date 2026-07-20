// Крок 5 · Ланка 2 — Сума тривалості й тихий рядок реалістичності в «Сьогодні».
// estimateTodayMinutes додає duration лише тих намірів, що СПРАВДІ належать сьогодні: моментні
// active («Готове до дії») + прострочені («Прострочено»). Безумовні `none` («Будь-коли») НЕ
// рахуються — вони не про сьогодні, і їх включення брехало б про день. Наміри без duration
// (null) не ламають суму. formatDayLoad перетворює хвилини на тиху фразу «…приблизно на N годин»
// (слово «приблизно» — ОБОВʼЯЗКОВЕ; порожній/увесь-null день → null, рядок не висить безглуздо).
// Тон — констатація, не докір: жодного «перевантаження»/«не встигнеш»/червоного.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { estimateTodayMinutes, formatDayLoad } from "@/lib/realism";
import { DayLoadLine } from "@/components/DayLoadLine";
import type { TodayView } from "@/lib/today";
import type { Condition, Intent } from "@/lib/types";

const TIME: Condition = {
  type: "time",
  value: { kind: "daypart", at: null, weekday: null, daypart: "morning" },
};
const GEO: Condition = { type: "location", value: { city: "Львів" } };
const NONE: Condition = { type: "none" };

function intent(over: Partial<Intent> & { id: string }): Intent {
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

function view(over: Partial<TodayView>): TodayView {
  return { active: [], overdue: [], ...over };
}

describe("estimateTodayMinutes — сума справді сьогоднішніх намірів", () => {
  it("додає моментні active (time+location) і прострочені; пропускає none", () => {
    const v = view({
      active: [
        intent({ id: "t", condition: TIME, duration: 60 }),
        intent({ id: "g", condition: GEO, duration: 30 }),
        intent({ id: "n", condition: NONE, duration: 120 }), // «будь-коли» — не рахуємо
      ],
      overdue: [intent({ id: "o", condition: TIME, duration: 60 })],
    });
    expect(estimateTodayMinutes(v)).toBe(150); // 60 + 30 + 60
  });

  it("null-тривалості не ламають суму (пропускаються)", () => {
    const v = view({
      active: [
        intent({ id: "t", condition: TIME, duration: null }),
        intent({ id: "g", condition: GEO, duration: 30 }),
      ],
    });
    expect(estimateTodayMinutes(v)).toBe(30);
  });

  it("лише безумовні (none) → 0 (день «будь-коли», не про сьогодні)", () => {
    const v = view({ active: [intent({ id: "n", condition: NONE, duration: 60 })] });
    expect(estimateTodayMinutes(v)).toBe(0);
  });

  it("порожній день → 0", () => {
    expect(estimateTodayMinutes(view({}))).toBe(0);
  });
});

describe("formatDayLoad — тиха фраза, обовʼязкове «приблизно»", () => {
  it("0 хвилин → null (рядок не показуємо)", () => {
    expect(formatDayLoad(0)).toBeNull();
  });

  it("120 хв → «приблизно» + «2 години»", () => {
    const s = formatDayLoad(120)!;
    expect(s).toContain("приблизно");
    expect(s).toContain("2 години");
  });

  it("60 хв → «приблизно на годину»", () => {
    const s = formatDayLoad(60)!;
    expect(s).toContain("приблизно");
    expect(s).toContain("годину");
  });

  it("150 хв → «2,5 години»", () => {
    expect(formatDayLoad(150)!).toContain("2,5 години");
  });

  it("30 хв → «пів години»", () => {
    const s = formatDayLoad(30)!;
    expect(s).toContain("приблизно");
    expect(s).toContain("пів години");
  });

  it("300 хв → «5 годин»", () => {
    expect(formatDayLoad(300)!).toContain("5 годин");
  });

  it("тон — констатація, без докору/тривоги", () => {
    const s = formatDayLoad(600)!;
    for (const alarm of ["перевант", "не встигн", "занадто", "забагато", "встигнеш"]) {
      expect(s).not.toContain(alarm);
    }
  });
});

describe("DayLoadLine — рендер рядка під датою", () => {
  it("показує тихий рядок, коли є вага", () => {
    render(<DayLoadLine minutes={120} />);
    expect(screen.getByText(/приблизно/)).toBeInTheDocument();
  });

  it("нічого не рендерить на порожньому/all-null дні (0 хв)", () => {
    const { container } = render(<DayLoadLine minutes={0} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/приблизно/)).not.toBeInTheDocument();
  });
});
