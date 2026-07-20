// Крок 4 · Ланки 3-4 — відбір і ПОСТІЙНІСТЬ простроченого + термінальна дія done.
// Механізм overdue (buildToday → isOverdue → timeIsOverdue) уже існує; тут його не
// переписуємо, а фіксуємо контракт: минула дата → overdue, лишається overdue й наступного
// дня (перерахунок від зсунутого now), а «done» прибирає її з секції. Плюс регрес: сьогодні
// → active, майбутнє → ні туди, ні туди (живе на Заплановано).

import { describe, expect, it } from "vitest";
import { buildToday } from "@/lib/today";
import type { Intent } from "@/lib/types";

const TODAY = new Date(2026, 6, 20); // 20 липня 2026
const TOMORROW = new Date(2026, 6, 21);

function datedIntent(atISO: string, over: Partial<Intent> = {}): Intent {
  return {
    id: "i1",
    text: "забути посилку",
    priority: "medium",
    status: "open",
    condition: { type: "time", value: { kind: "date", at: atISO, weekday: null, daypart: null } },
    createdAt: "2026-07-01T10:00:00.000Z",
    todayOverride: null,
    recurring: false,
    duration: null,
    ...over,
  };
}

describe("buildToday — секція «Прострочено» (відбір і постійність)", () => {
  it("минула дата (учора) → overdue, не active", async () => {
    const i = datedIntent("2026-07-19T00:00:00");
    const { active, overdue } = await buildToday([i], { now: TODAY });
    expect(overdue.map((x) => x.id)).toEqual(["i1"]);
    expect(active).toHaveLength(0);
  });

  it("постійність: лишається overdue й наступного дня (перерахунок від зсунутого now)", async () => {
    const i = datedIntent("2026-07-19T00:00:00");
    const today = await buildToday([i], { now: TODAY });
    const tomorrow = await buildToday([i], { now: TOMORROW });
    expect(today.overdue.map((x) => x.id)).toEqual(["i1"]);
    expect(tomorrow.overdue.map((x) => x.id)).toEqual(["i1"]); // все ще прострочене
  });

  it("виконаний (done) прострочений зникає з overdue", async () => {
    const i = datedIntent("2026-07-19T00:00:00", { status: "done" });
    const { active, overdue } = await buildToday([i], { now: TODAY });
    expect(overdue).toHaveLength(0);
    expect(active).toHaveLength(0);
  });

  it("відпущений (released) прострочений зникає з overdue", async () => {
    const i = datedIntent("2026-07-19T00:00:00", { status: "released" });
    const { overdue } = await buildToday([i], { now: TODAY });
    expect(overdue).toHaveLength(0);
  });

  it("регрес: сьогоднішня дата → active, не overdue", async () => {
    const i = datedIntent("2026-07-20T00:00:00");
    const { active, overdue } = await buildToday([i], { now: TODAY });
    expect(active.map((x) => x.id)).toEqual(["i1"]);
    expect(overdue).toHaveLength(0);
  });

  it("регрес: майбутня дата → ні active, ні overdue (живе на Заплановано)", async () => {
    const i = datedIntent("2026-07-24T00:00:00");
    const { active, overdue } = await buildToday([i], { now: TODAY });
    expect(active).toHaveLength(0);
    expect(overdue).toHaveLength(0);
  });
});
