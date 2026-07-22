// Крок 7 · Ланка 3 (інтеграція store): «Підтвердити» має провести deadline-кандидатів крізь
// движок розподілу — вони лягають у backlog уже як конкретні `datetime`-наміри, а не як
// безумовні `none`. Дедлайн беремо ДИНАМІЧНО (now + 3 год), щоб тест не залежав від реального
// годинника (commitAllCandidates рахує «зараз» через new Date()). Точну арифметику розподілу
// перевіряють детерміновані тести schedule/schedule-apply — тут доводимо саме ПРОВОДКУ.

import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetStoreForTests,
  commitAllCandidates,
  replaceCandidates,
} from "@/lib/store";
import type { Intent, ParsedIntent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";

function readIntents(): Intent[] {
  return JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]");
}

// Naive local ISO (no Z) — the shape the parser/store use.
function naive(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:00`;
}

function deadlineTask(text: string, deadline: string): ParsedIntent {
  return {
    text,
    priority: "medium",
    recurring: false,
    duration: 60,
    deadline,
    condition: { type: "none" },
  };
}

describe("commitAllCandidates — розподіл до дедлайну (проводка)", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStoreForTests();
  });

  it("deadline-кандидати лягають у backlog як datetime-наміри, а не none", () => {
    // +6 год від зараз: вікно (360 хв) з великим запасом над 3×60 хв, тож усі три вміщуються
    // незалежно від дрібного дрейфу між цим `Date.now()` і `new Date()` всередині коміту.
    const deadline = naive(new Date(Date.now() + 6 * 60 * 60 * 1000));
    replaceCandidates([
      deadlineTask("зустріч один", deadline),
      deadlineTask("зустріч два", deadline),
      deadlineTask("зустріч три", deadline),
    ]);
    commitAllCandidates();

    const saved = readIntents();
    expect(saved).toHaveLength(3);
    // Усі три отримали конкретну годину (datetime), жоден не лишився безумовним.
    for (const i of saved) {
      expect(i.condition.type).toBe("time");
      if (i.condition.type === "time") {
        expect(i.condition.value.kind).toBe("datetime");
        expect(i.condition.value.at).toMatch(/T\d{2}:\d{2}:\d{2}$/);
      }
    }
    // Три різні години (розподілені, не злиплі).
    const hours = new Set(
      saved.map((i) => (i.condition.type === "time" ? i.condition.value.at : null)),
    );
    expect(hours.size).toBe(3);
  });

  it("звичайні (без deadline) кандидати комітяться незмінними", () => {
    replaceCandidates([
      {
        text: "купити молоко",
        priority: "low",
        recurring: false,
        duration: null,
        condition: { type: "none" },
      },
    ]);
    commitAllCandidates();
    const saved = readIntents();
    expect(saved).toHaveLength(1);
    expect(saved[0].condition).toEqual({ type: "none" });
  });

  // Купа 3 (аудит, coverage gap): коли в ОДНОМУ пакеті є і deadline-кандидат, і кандидати з
  // ВЖЕ названою умовою (location / конкретний datetime), пакет проходить повний шлях розподілу
  // (identity-раннаут обходиться, бо some(deadline) === true). Незаймана умова НЕ deadline-
  // кандидата мусить доїхати в backlog БАЙТ-У-БАЙТ — коміт не має її мутувати. Окремо: datetime-
  // кандидат того ж пакета читається як occupied (Крок 1 фікс), але сам лишається незмінним.
  it("умова НЕ deadline-кандидата не мутується, навіть коли в пакеті є deadline-справи", () => {
    const deadline = naive(new Date(Date.now() + 6 * 60 * 60 * 1000));
    const callAt = naive(new Date(Date.now() + 4 * 60 * 60 * 1000)); // фіксований дзвінок
    replaceCandidates([
      // 1) location-кандидат — умова має пройти незмінною
      {
        text: "зайти в аптеку",
        priority: "medium",
        recurring: false,
        duration: 30,
        condition: { type: "location", value: { city: "Львів" } },
      },
      // 2) фіксований datetime-кандидат — умова незмінна (і водночас occupied для розподілу)
      {
        text: "дзвінок з інвестором",
        priority: "medium",
        recurring: false,
        duration: 60,
        condition: { type: "time", value: { kind: "datetime", at: callAt, weekday: null, daypart: null } },
      },
      // 3) deadline-справа — ось вона й вмикає повний шлях розподілу
      deadlineTask("зібрати сумку", deadline),
    ]);
    commitAllCandidates();

    const saved = readIntents();
    expect(saved).toHaveLength(3);

    const apteka = saved.find((i) => i.text === "зайти в аптеку")!;
    const call = saved.find((i) => i.text === "дзвінок з інвестором")!;
    const bag = saved.find((i) => i.text === "зібрати сумку")!;

    // location-умова доїхала байт-у-байт
    expect(apteka.condition).toEqual({ type: "location", value: { city: "Львів" } });
    // datetime-умова доїхала байт-у-байт (не зсунулась, хоч і слугувала occupied-блоком)
    expect(call.condition).toEqual({
      type: "time",
      value: { kind: "datetime", at: callAt, weekday: null, daypart: null },
    });
    // а deadline-справа таки отримала конкретну годину
    expect(bag.condition.type).toBe("time");
    if (bag.condition.type === "time") expect(bag.condition.value.kind).toBe("datetime");
  });
});
