// Правка · Тап на порожній день у календарі. Кожен день у календарній лінзі «Заплановано» —
// тапабельний: день З намірами звужує список до себе, ПОРОЖНІЙ день показує теплий рядок «на
// цей день поки порожньо» у тому самому слоті (не мовчазна відсутність реакції = зламаний тап).
// Тут перевіряємо саме реакцію на тап; скрол-згортання календаря не чіпається і не тестується.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// PlannedPage тепер бере useRouter (тап на «сьогодні» в календарі → /today). Тут навігація не
// перевіряється — заглушаємо, щоб app-router-контекст не був обов'язковим у jsdom.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import PlannedPage from "@/app/planned/page";
import { IntentEditorProvider } from "@/components/IntentEditorSheet";
import {
  __resetStoreForTests,
  commitAllCandidates,
  replaceCandidates,
} from "@/lib/store";
import type { ParsedIntent } from "@/lib/types";

// A future-dated time intent lands in the waiting field → gets a calendar dot on its day.
function timeIntent(atISO: string, text: string): ParsedIntent {
  return {
    text,
    priority: "medium",
    recurring: false,
    condition: { type: "time", value: { kind: "date", at: atISO, weekday: null, daypart: null } },
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
  // Pin the clock so «22 липня» is a FUTURE day within the rendered month (July 2026) — otherwise
  // the seeded intent could be past → overdue → never in the waiting field / calendar. Fake ONLY
  // Date, leaving timers real so testing-library's async findBy still polls.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 20, 10, 0, 0)); // 20 липня 2026
  localStorage.clear();
  __resetStoreForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Заплановано — тап на день у календарі реагує", () => {
  it("тап на день З намірами показує наміри того дня", async () => {
    seed(timeIntent("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    const day22 = await screen.findByRole("button", { name: "22 — є наміри" });
    fireEvent.click(day22);

    expect(screen.getByText("здати звіт")).toBeInTheDocument();
    expect(screen.queryByText("На цей день поки порожньо.")).not.toBeInTheDocument();
  });

  it("тап на ПОРОЖНІЙ день показує теплий рядок замість мовчазної відсутності реакції", async () => {
    seed(timeIntent("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    // Wait for the calendar (needs at least one dotted day to render), then tap a bare day.
    await screen.findByRole("button", { name: "22 — є наміри" });
    fireEvent.click(screen.getByRole("button", { name: "15 — порожньо" }));

    expect(screen.getByText("На цей день поки порожньо.")).toBeInTheDocument();
    // Narrowed to the empty day → the other day's intent is not in this slot.
    expect(screen.queryByText("здати звіт")).not.toBeInTheDocument();
  });

  it("вибір іншого дня міняє слот: порожній рядок → наміри дня з намірами", async () => {
    seed(timeIntent("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    await screen.findByRole("button", { name: "22 — є наміри" });

    fireEvent.click(screen.getByRole("button", { name: "15 — порожньо" }));
    expect(screen.getByText("На цей день поки порожньо.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "22 — є наміри" }));
    expect(screen.getByText("здати звіт")).toBeInTheDocument();
    expect(screen.queryByText("На цей день поки порожньо.")).not.toBeInTheDocument();
  });
});
