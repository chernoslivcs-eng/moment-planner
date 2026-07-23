// UX-фікс · Сьогоднішній день у календарі осі «Час» (екран «Заплановано»).
// Дві поведінки, суто UI-шар:
//   1) Тап на сьогодні в календарі → перехід на таб «Сьогодні» (та сама навігація, що в BottomNav
//      → useRouter().push("/today")). Раніше тап давав порожнечу — зламане очікування.
//   2) Крапка-індикатор під сьогоднішнім днем, якщо на сьогодні Є open-наміри — включно з
//      безумовними ("none"), що живуть у «Будь-коли». Той самий дот, що вже стоїть під майбутніми
//      днями; тут лише розширюємо його умову на сьогодні.
// Скрол-згортання календаря не чіпається. buildToday/чекери/статуси/store — недоторкані.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Навігація — той самий next/navigation, що ним ходить BottomNav. Мокаємо push, аби довести
// саме проводку тапу «сьогодні» → /today.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import PlannedPage from "@/app/planned/page";
import { IntentEditorProvider } from "@/components/IntentEditorSheet";
import {
  __resetStoreForTests,
  commitAllCandidates,
  replaceCandidates,
} from "@/lib/store";
import type { ParsedIntent } from "@/lib/types";

// Майбутній датований намір — лягає в поле очікування → рендерить календарну лінзу (без хоча б
// одного датованого наміру календар не показується взагалі).
function futureTime(atISO: string, text: string): ParsedIntent {
  return {
    text,
    priority: "medium",
    recurring: false,
    condition: { type: "time", value: { kind: "date", at: atISO, weekday: null, daypart: null } },
    duration: null,
  };
}

// Безумовний намір — завжди «доречний сьогодні», живе у «Будь-коли» (вісь «Інше»). Має додавати
// сьогоднішньому дню крапку, хоч і без часу.
function anytime(text: string): ParsedIntent {
  return {
    text,
    priority: "medium",
    recurring: false,
    condition: { type: "none" },
    duration: null,
  };
}

function seed(...intents: ParsedIntent[]) {
  act(() => {
    replaceCandidates(intents);
    commitAllCandidates();
  });
}

function renderPlanned() {
  return render(
    <IntentEditorProvider>
      <PlannedPage />
    </IntentEditorProvider>,
  );
}

beforeEach(() => {
  // Годинник запнутий на 20 липня 2026 — сьогодні=20 у межах намальованого місяця; майбутній
  // намір на 22-е лишається у полі очікування (не прострочений).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 20, 10, 0, 0));
  localStorage.clear();
  __resetStoreForTests();
  pushMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Заплановано — сьогоднішній день у календарі", () => {
  it("тап на сьогодні веде на таб «Сьогодні» (push /today)", async () => {
    // Один майбутній намір, щоб календар з'явився; сьогодні порожнє.
    seed(futureTime("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    const today = await screen.findByRole("button", { name: "20 — сьогодні" });
    fireEvent.click(today);

    expect(pushMock).toHaveBeenCalledWith("/today");
  });

  it("крапка під сьогодні, коли на сьогодні є наміри (у т.ч. безумовні з «Будь-коли»)", async () => {
    seed(futureTime("2026-07-22T00:00:00", "здати звіт"), anytime("купити молоко"));
    renderPlanned();

    // Наявність намірів на сьогодні кодуємо в доступній назві кнопки (крапка — aria-hidden span).
    await screen.findByRole("button", { name: "20 — сьогодні, є наміри" });
    // Порожнього варіанту бути не має.
    expect(screen.queryByRole("button", { name: "20 — сьогодні" })).not.toBeInTheDocument();
  });

  it("немає крапки під сьогодні на порожньому дні", async () => {
    seed(futureTime("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    await screen.findByRole("button", { name: "20 — сьогодні" });
    expect(
      screen.queryByRole("button", { name: "20 — сьогодні, є наміри" }),
    ).not.toBeInTheDocument();
  });
});
