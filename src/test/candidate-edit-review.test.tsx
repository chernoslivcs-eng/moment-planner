// Крок 6 · Ланка 4 — Той самий редактор і в Розборі (UI). Тап по ТЕКСТУ кандидата в
// CaptureSheet → ReviewStep відкриває той самий IntentEditor, що й на «Сьогодні»/«Заплановано»;
// «Готово» зберігає правку через updateCandidate (текст/пріоритет/умова/тривалість), «Скасувати»
// лишає кандидата як був. ✕ (прибрати з розбору) — окрема зона, редактор не відкриває. Один
// компонент редактора на всі контексти, не копії.

import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { CaptureSheetProvider, useCaptureSheet } from "@/components/CaptureSheet";
import { __resetStoreForTests, replaceCandidates } from "@/lib/store";
import type { Candidate, ParsedIntent } from "@/lib/types";

const CANDIDATES_KEY = "mp.candidates.v1";

function parsed(over: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    text: "зустріч",
    priority: "medium",
    recurring: false,
    condition: { type: "none" },
    duration: null,
    ...over,
  };
}

function savedCandidates(): Candidate[] {
  return JSON.parse(localStorage.getItem(CANDIDATES_KEY) ?? "[]") as Candidate[];
}

// Opens the sheet on mount so it lands on the review step (candidates already seeded).
function OpenOnMount() {
  const { open } = useCaptureSheet();
  useEffect(() => open(), [open]);
  return null;
}

function renderReview() {
  return render(
    <CaptureSheetProvider>
      <OpenOnMount />
    </CaptureSheetProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetStoreForTests();
});

describe("Розбір — тап по кандидату відкриває той самий редактор", () => {
  it("тап по тексту кандидата відкриває редактор (поле тексту зʼявляється)", () => {
    act(() => replaceCandidates([parsed({ text: "подзвонити мамі" })]));
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "подзвонити мамі" }));
    expect(screen.getByRole("textbox", { name: /текст/i })).toHaveValue("подзвонити мамі");
  });

  it("«Готово» зберігає правку тексту через updateCandidate", () => {
    act(() => replaceCandidates([parsed({ text: "старий текст" })]));
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "старий текст" }));
    fireEvent.change(screen.getByRole("textbox", { name: /текст/i }), {
      target: { value: "новий текст" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    expect(savedCandidates()[0].text).toBe("новий текст");
  });

  it("«Скасувати» лишає кандидата як був", () => {
    act(() => replaceCandidates([parsed({ text: "недоторканий" })]));
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "недоторканий" }));
    fireEvent.change(screen.getByRole("textbox", { name: /текст/i }), {
      target: { value: "не має зберегтись" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(savedCandidates()[0].text).toBe("недоторканий");
  });

  it("зміна пріоритету доходить у кандидата", () => {
    act(() => replaceCandidates([parsed({ text: "справа", priority: "medium" })]));
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "справа" }));
    fireEvent.click(screen.getByRole("button", { name: "важливе" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    expect(savedCandidates()[0].priority).toBe("high");
  });
});

describe("Розбір — вісь часу редагується й комітиться в кандидата (той самий редактор)", () => {
  it("додати годину кандидату (сьогодні + час) → datetime доїжджає у кандидата", () => {
    act(() => replaceCandidates([parsed({ text: "подзвонити" })]));
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "подзвонити" }));
    fireEvent.click(screen.getByRole("button", { name: "сьогодні" }));
    fireEvent.change(screen.getByLabelText("Час"), { target: { value: "15:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    const cond = savedCandidates()[0].condition;
    expect(cond.type).toBe("time");
    if (cond.type === "time") {
      expect(cond.value.kind).toBe("datetime");
      expect(cond.value.at?.slice(11, 16)).toBe("15:00");
    }
  });

  it("прибрати годину («—») кандидату з datetime → лишається цілоденна date", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}T09:00:00`;
    act(() =>
      replaceCandidates([
        parsed({
          text: "зустріч зранку",
          condition: { type: "time", value: { kind: "datetime", at: iso, weekday: null, daypart: null } },
        }),
      ]),
    );
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "зустріч зранку" }));
    expect(screen.getByLabelText("Час")).toHaveValue("09:00");
    fireEvent.click(screen.getByRole("button", { name: "Прибрати час" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    const cond = savedCandidates()[0].condition;
    expect(cond.type).toBe("time");
    if (cond.type === "time") {
      expect(cond.value.kind).toBe("date");
      expect(cond.value.at?.slice(11, 16)).toBe("00:00");
    }
  });
});

describe("Розбір — recurring видно до коміту", () => {
  it("кандидат recurring + умова-місце показує маркер повтору в розборі", () => {
    act(() =>
      replaceCandidates([
        parsed({
          text: "кава на каві",
          recurring: true,
          condition: { type: "location", value: { city: "Львів" } },
        }),
      ]),
    );
    renderReview();

    expect(screen.getByRole("img", { name: /повтор/i })).toBeInTheDocument();
  });
});
