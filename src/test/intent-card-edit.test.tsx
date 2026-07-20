// Крок 6 · Ланка 2 — Тап по тексту наміру відкриває редактор. Текст стає окремою зоною-тапом
// (onEdit), а тик (виконано) і ✕ (прибрати/відпустити) лишаються ОКРЕМИМИ зонами — вони не
// відкривають редактор (рішення реконсиляції §6). Без onEdit картка лишається звичайною (текст
// не інтерактивний), щоб інші контексти (розбір-гейт, empty-state) не набули випадкового тапу.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntentCard } from "@/components/IntentCard";
import type { Condition } from "@/lib/types";

const NONE: Condition = { type: "none" };

describe("IntentCard — тап по тексту → onEdit", () => {
  it("тап по тексту викликає onEdit", () => {
    const onEdit = vi.fn();
    render(<IntentCard text="подзвонити" priority="medium" condition={NONE} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /подзвонити/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("тик (виконано) не відкриває редактор", () => {
    const onEdit = vi.fn();
    const onComplete = vi.fn();
    render(
      <IntentCard
        text="подзвонити"
        priority="medium"
        condition={NONE}
        onEdit={onEdit}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Виконано" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("✕ (прибрати) не відкриває редактор", () => {
    const onEdit = vi.fn();
    const onDismiss = vi.fn();
    render(
      <IntentCard
        text="подзвонити"
        priority="medium"
        condition={NONE}
        onEdit={onEdit}
        onDismiss={onDismiss}
        dismissLabel="Прибрати з сьогодні"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Прибрати з сьогодні" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("без onEdit текст не інтерактивний (не кнопка)", () => {
    render(<IntentCard text="подзвонити" priority="medium" condition={NONE} />);
    expect(screen.queryByRole("button", { name: /подзвонити/ })).not.toBeInTheDocument();
  });
});
