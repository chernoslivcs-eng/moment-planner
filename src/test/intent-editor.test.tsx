// Крок 6 · Ланка 2 — Єдиний редактор (один компонент на всі контексти). IntentEditor — це ОДНЕ
// вікно правки для наміру: текст, пріоритет, умова (час/місце/без умови), recurring (лише коли
// умова = місце, з Крок 2) і duration (тихі пресети з Крок 5). Робоча копія в стані; коміт лише
// на «Готово» → onSave(edit). «Скасувати» → onCancel, без збереження. Умова жива: перемикання
// сьогодні/завтра/обрати день/без умови/місце будує коректну Condition. recurring-перемикач
// показуємо ТІЛЬКИ для місця (для часу/без-умови ховаємо — часова рекурентність поза MVP).

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntentEditor } from "@/components/IntentEditor";
import type { Condition, Intent } from "@/lib/types";

const NOW = new Date(2026, 6, 20); // 20 липня 2026

type EditableIntent = Pick<Intent, "text" | "priority" | "condition" | "recurring" | "duration">;

const NONE: Condition = { type: "none" };
const GEO: Condition = { type: "location", value: { city: "Львів" } };
const TIME_TODAY: Condition = {
  type: "time",
  value: { kind: "date", at: "2026-07-20T00:00:00", weekday: null, daypart: null },
};
// Конкретна година на сьогодні: kind === "datetime". Це і є баг-кейс — година «15:00» є в даних,
// але старий initialKey кидав такий намір у чип «сьогодні» (цілоденний, без поля години), тож
// година ставала невидимою і виглядала втраченою.
const DATETIME_TODAY: Condition = {
  type: "time",
  value: { kind: "datetime", at: "2026-07-20T15:00:00", weekday: null, daypart: null },
};
const DAYPART_EVENING: Condition = {
  type: "time",
  value: { kind: "daypart", at: null, weekday: null, daypart: "evening" },
};
const WEEKDAY_FRIDAY: Condition = {
  type: "time",
  value: { kind: "weekday", at: null, weekday: "п'ятниця", daypart: null },
};

function base(over: Partial<EditableIntent> = {}): EditableIntent {
  return {
    text: "зустріч",
    priority: "medium",
    condition: NONE,
    recurring: false,
    duration: null,
    ...over,
  };
}

function renderEditor(over: Partial<EditableIntent> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<IntentEditor intent={base(over)} now={NOW} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel };
}

describe("IntentEditor — префіл наявних значень", () => {
  it("текст наміру у полі", () => {
    renderEditor({ text: "подзвонити мамі" });
    expect(screen.getByRole("textbox", { name: /текст/i })).toHaveValue("подзвонити мамі");
  });

  it("активний пріоритет позначено", () => {
    renderEditor({ priority: "high" });
    expect(screen.getByRole("button", { name: "важливе" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "буденне" })).toHaveAttribute("aria-pressed", "false");
  });

  it("активна умова позначена (без умови)", () => {
    renderEditor({ condition: NONE });
    expect(screen.getByRole("button", { name: "без умови" })).toHaveAttribute("aria-pressed", "true");
  });

  it("duration-пресет відображає поточне значення", () => {
    renderEditor({ duration: 30 });
    expect(screen.getByRole("button", { name: "30 хв" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("IntentEditor — recurring-перемикач лише для місця", () => {
  it("прихований для «без умови»", () => {
    renderEditor({ condition: NONE });
    expect(screen.queryByRole("switch", { name: /повтор/i })).not.toBeInTheDocument();
  });

  it("прихований для часової умови", () => {
    renderEditor({ condition: TIME_TODAY });
    expect(screen.queryByRole("switch", { name: /повтор/i })).not.toBeInTheDocument();
  });

  it("зʼявляється, коли умова = місце", () => {
    renderEditor({ condition: GEO });
    expect(screen.getByRole("switch", { name: /повтор/i })).toBeInTheDocument();
  });

  it("зʼявляється після перемикання на «місце»", () => {
    renderEditor({ condition: NONE });
    expect(screen.queryByRole("switch", { name: /повтор/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "місце" }));
    expect(screen.getByRole("switch", { name: /повтор/i })).toBeInTheDocument();
  });
});

describe("IntentEditor — збереження / скасування", () => {
  it("«Готово» → onSave з відредагованим текстом", () => {
    const { onSave } = renderEditor({ text: "старий" });
    fireEvent.change(screen.getByRole("textbox", { name: /текст/i }), {
      target: { value: "новий текст" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ text: "новий текст" });
  });

  it("«Скасувати» → onCancel, onSave не викликано", () => {
    const { onSave, onCancel } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Скасувати" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("зміна пріоритету доходить у onSave", () => {
    const { onSave } = renderEditor({ priority: "medium" });
    fireEvent.click(screen.getByRole("button", { name: "колись" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ priority: "low" });
  });

  it("клік по duration-пресету доходить у onSave", () => {
    const { onSave } = renderEditor({ duration: null });
    fireEvent.click(screen.getByRole("button", { name: "1 год" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ duration: 60 });
  });
});

describe("IntentEditor — жива умова", () => {
  it("«сьогодні» → time-умова з сьогоднішньою датою", () => {
    const { onSave } = renderEditor({ condition: NONE });
    fireEvent.click(screen.getByRole("button", { name: "сьогодні" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    const cond = onSave.mock.calls[0][0].condition as Condition;
    expect(cond.type).toBe("time");
    if (cond.type === "time") expect(cond.value.at).toContain("2026-07-20");
  });

  it("«завтра» → time-умова з завтрашньою датою", () => {
    const { onSave } = renderEditor({ condition: NONE });
    fireEvent.click(screen.getByRole("button", { name: "завтра" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    const cond = onSave.mock.calls[0][0].condition as Condition;
    expect(cond.type).toBe("time");
    if (cond.type === "time") expect(cond.value.at).toContain("2026-07-21");
  });

  it("«місце» + місто → location-умова з містом", () => {
    const { onSave } = renderEditor({ condition: NONE });
    fireEvent.click(screen.getByRole("button", { name: "місце" }));
    fireEvent.change(screen.getByRole("textbox", { name: /місто/i }), {
      target: { value: "Одеса" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    const cond = onSave.mock.calls[0][0].condition as Condition;
    expect(cond).toEqual({ type: "location", value: { city: "Одеса" } });
  });

  it("«без умови» → none", () => {
    const { onSave } = renderEditor({ condition: TIME_TODAY });
    fireEvent.click(screen.getByRole("button", { name: "без умови" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0].condition).toEqual({ type: "none" });
  });
});

describe("IntentEditor — умову НЕ чіпали → зберігається ціла (daypart/weekday)", () => {
  it("daypart «ввечері» переживає збереження без зміни умови", () => {
    const { onSave } = renderEditor({ condition: DAYPART_EVENING });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0].condition).toBeUndefined();
  });

  it("weekday «п'ятниця» переживає збереження без зміни умови (не стрибає на сьогодні)", () => {
    const { onSave } = renderEditor({ condition: WEEKDAY_FRIDAY });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0].condition).toBeUndefined();
  });

  it("правка лише тексту не чіпає умову daypart", () => {
    const { onSave } = renderEditor({ condition: DAYPART_EVENING, text: "зарядка" });
    fireEvent.change(screen.getByRole("textbox", { name: /текст/i }), {
      target: { value: "довга зарядка" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ text: "довга зарядка" });
    expect(onSave.mock.calls[0][0].condition).toBeUndefined();
  });

  it("ТОРКНУВСЯ умови (daypart → «завтра») → нова умова застосовується", () => {
    const { onSave } = renderEditor({ condition: DAYPART_EVENING });
    fireEvent.click(screen.getByRole("button", { name: "завтра" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    const cond = onSave.mock.calls[0][0].condition as Condition;
    expect(cond.type).toBe("time");
    if (cond.type === "time") {
      expect(cond.value.kind).toBe("date");
      expect(cond.value.at).toContain("2026-07-21");
    }
  });
});

describe("IntentEditor — datetime-умова відкривається з видимою годиною", () => {
  it("datetime на сьогодні → чип «обрати день», поля дати й часу заповнені", () => {
    renderEditor({ condition: DATETIME_TODAY });
    expect(screen.getByRole("button", { name: "обрати день" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "сьогодні" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByLabelText("Дата")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("Час")).toHaveValue("15:00");
  });

  it("date-умова на сьогодні (без години) → початковий чип «сьогодні»", () => {
    renderEditor({ condition: TIME_TODAY });
    expect(screen.getByRole("button", { name: "сьогодні" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "обрати день" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("datetime відкрито й не чіпано → «Готово» лишає умову цілою (година не втрачена)", () => {
    const { onSave } = renderEditor({ condition: DATETIME_TODAY });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    // Умову не чіпали → патч її не містить, збережений намір лишається з datetime «15:00».
    expect(onSave.mock.calls[0][0].condition).toBeUndefined();
  });

  it("з datetime явно тапнути «сьогодні» → година свідомо зрізається (цілоденна умова)", () => {
    const { onSave } = renderEditor({ condition: DATETIME_TODAY });
    fireEvent.click(screen.getByRole("button", { name: "сьогодні" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    const cond = onSave.mock.calls[0][0].condition as Condition;
    expect(cond.type).toBe("time");
    if (cond.type === "time") {
      expect(cond.value.kind).toBe("date");
      expect(cond.value.at).toContain("2026-07-20");
      expect(cond.value.at?.slice(11, 16)).toBe("00:00");
    }
  });

  it("daypart/weekday початковий мапінг не зламано (не стрибають на «обрати день»)", () => {
    const { onCancel } = renderEditor({ condition: DAYPART_EVENING });
    // daypart має at:null → лишається «обрати день»-fallback, але поля порожні, а не datetime.
    expect(screen.getByLabelText("Дата")).toHaveValue("");
    expect(screen.getByLabelText("Час")).toHaveValue("");
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("IntentEditor — recurring семантика", () => {
  it("місце + увімкнений повтор → recurring:true", () => {
    const { onSave } = renderEditor({ condition: GEO, recurring: false });
    fireEvent.click(screen.getByRole("switch", { name: /повтор/i }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ recurring: true });
  });

  it("перемикання з місця (recurring) на час → recurring скидається у false", () => {
    const { onSave } = renderEditor({ condition: GEO, recurring: true });
    fireEvent.click(screen.getByRole("button", { name: "сьогодні" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ recurring: false });
  });
});
