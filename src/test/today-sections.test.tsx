// Крок 3 · Ланка 1 — Ієрархія «Сьогодні». Презентаційний поділ уже побудованого
// view.active на дві зони: «Готове до дії» (моментні умови — time/location) і тиху
// зону «Будь-коли» (безумовні `none`), плюс «Минуло» (overdue) внизу. Це ЧИСТА
// презентація: жоден намір не губиться і не дублюється, набір Today не змінюється —
// лише групується. Порожні секції ховають свій заголовок (не сміття без вмісту).

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { TodaySections } from "@/components/TodaySections";
import { IntentEditorProvider } from "@/components/IntentEditorSheet";
import type { TodayView } from "@/lib/today";
import type { Condition, Intent } from "@/lib/types";

const NOW = new Date(2026, 6, 20);

// TodaySections' active cards open the shared editor on tap, so they must render under its
// provider (useIntentEditor). Wrap every render — presentation assertions are unaffected.
function renderWithEditor(ui: ReactElement) {
  return render(<IntentEditorProvider>{ui}</IntentEditorProvider>);
}

const TIME: Condition = {
  type: "time",
  value: { kind: "daypart", at: null, weekday: null, daypart: "morning" },
};
const GEO: Condition = { type: "location", value: { city: "Львів" } };
const NONE: Condition = { type: "none" };

function intent(over: Partial<Intent> & { id: string; text: string }): Intent {
  return {
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

describe("TodaySections — три зони «Сьогодні»", () => {
  it("розводить моментні / безумовні / минулі у три секції", () => {
    renderWithEditor(
      <TodaySections
        now={NOW}
        view={view({
          active: [
            intent({ id: "t1", text: "подзвонити мамі", condition: TIME }),
            intent({ id: "n1", text: "купити молоко", condition: NONE }),
          ],
          overdue: [intent({ id: "o1", text: "здати звіт", condition: TIME })],
        })}
      />,
    );

    // усі три заголовки присутні
    const ready = screen.getByRole("region", { name: "Готове до дії" });
    const anytime = screen.getByRole("region", { name: "Будь-коли" });
    const passed = screen.getByRole("region", { name: "Прострочено" });

    // моментний намір — під «Готове до дії», не під «Будь-коли»
    within(ready).getByText("подзвонити мамі");
    expect(within(anytime).queryByText("подзвонити мамі")).not.toBeInTheDocument();

    // безумовний намір — під «Будь-коли», не під «Готове до дії»
    within(anytime).getByText("купити молоко");
    expect(within(ready).queryByText("купити молоко")).not.toBeInTheDocument();

    // минулий — під «Минуло»
    within(passed).getByText("здати звіт");
  });

  it("нічого не губиться: усі активні наміри показані рівно раз", () => {
    renderWithEditor(
      <TodaySections
        now={NOW}
        view={view({
          active: [
            intent({ id: "t1", text: "подзвонити мамі", condition: TIME }),
            intent({ id: "g1", text: "кава на Каві", condition: GEO }),
            intent({ id: "n1", text: "купити молоко", condition: NONE }),
          ],
        })}
      />,
    );
    expect(screen.getAllByText("подзвонити мамі")).toHaveLength(1);
    expect(screen.getAllByText("кава на Каві")).toHaveLength(1);
    expect(screen.getAllByText("купити молоко")).toHaveLength(1);
  });

  it("порожні секції ховають заголовок (лише моментні → без «Будь-коли»/«Минуло»)", () => {
    renderWithEditor(
      <TodaySections
        now={NOW}
        view={view({
          active: [intent({ id: "t1", text: "подзвонити мамі", condition: TIME })],
        })}
      />,
    );
    expect(screen.getByRole("region", { name: "Готове до дії" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Будь-коли" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Прострочено" })).not.toBeInTheDocument();
  });

  it("картка простроченого має «Виконано», «Відпустити» і «Повернути в сьогодні»", () => {
    renderWithEditor(
      <TodaySections
        now={NOW}
        view={view({ overdue: [intent({ id: "o1", text: "здати звіт", condition: TIME })] })}
      />,
    );
    const passed = screen.getByRole("region", { name: "Прострочено" });
    // рівний вибір: виконати АБО відпустити — обидві дії присутні
    expect(within(passed).getByRole("button", { name: "Виконано" })).toBeInTheDocument();
    expect(within(passed).getByRole("button", { name: "Відпустити" })).toBeInTheDocument();
    expect(
      within(passed).getByRole("button", { name: "Повернути в сьогодні" }),
    ).toBeInTheDocument();
  });

  it("лише безумовні → показана тільки «Будь-коли»", () => {
    renderWithEditor(
      <TodaySections
        now={NOW}
        view={view({
          active: [intent({ id: "n1", text: "купити молоко", condition: NONE })],
        })}
      />,
    );
    expect(screen.getByRole("region", { name: "Будь-коли" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Готове до дії" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Прострочено" })).not.toBeInTheDocument();
  });
});
