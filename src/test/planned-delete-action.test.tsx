// Правка · ✕ «Відпустити» на картці «Заплановано». Той самий кутовий ✕, що на «Сьогодні»,
// той самий setIntentStatus(id, "released"): намір зникає з поверненням, не жорстке видалення.
// Зони рознесені як у Сьогодні: тап по ТЕКСТУ відкриває редактор, ✕ прибирає й редактора НЕ чіпає.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
import type { Intent, ParsedIntent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";

// A future-dated time intent lands in the waiting field → shows on the default «Час» axis.
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

function storedIntents(): Intent[] {
  return JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
}

function renderPlanned() {
  return render(
    <IntentEditorProvider>
      <PlannedPage />
    </IntentEditorProvider>,
  );
}

beforeEach(() => {
  // Pin the clock so «22 липня» is FUTURE → the seeded intent stays in the waiting field. Fake
  // ONLY Date, leaving timers real so testing-library's async findBy/waitFor still polls.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 20, 10, 0, 0)); // 20 липня 2026
  localStorage.clear();
  __resetStoreForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Заплановано — ✕ «Відпустити» на картці", () => {
  it("✕ переводить намір у released і прибирає картку", async () => {
    seed(timeIntent("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    await screen.findByText("здати звіт");
    fireEvent.click(screen.getByRole("button", { name: "Відпустити" }));

    await waitFor(() => expect(screen.queryByText("здати звіт")).not.toBeInTheDocument());
    expect(storedIntents()[0].status).toBe("released");
  });

  it("✕ не відкриває редактор (зони рознесені)", async () => {
    seed(timeIntent("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    await screen.findByText("здати звіт");
    fireEvent.click(screen.getByRole("button", { name: "Відпустити" }));

    // редактор НЕ виринув — його поле тексту відсутнє
    expect(screen.queryByRole("textbox", { name: /текст наміру/i })).not.toBeInTheDocument();
  });

  it("тап по тексту досі відкриває редактор (✕ його не зламав)", async () => {
    seed(timeIntent("2026-07-22T00:00:00", "здати звіт"));
    renderPlanned();

    const card = await screen.findByRole("button", { name: "здати звіт" });
    fireEvent.click(card);

    expect(screen.getByRole("textbox", { name: /текст наміру/i })).toHaveValue("здати звіт");
  });
});
