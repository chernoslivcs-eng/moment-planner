// Ланка 4 — UI: рекурентна ГЕО-картка. Форма з прототипу (розділ 8):
//   • маркер повтору замість тіка (не закривається галочкою),
//   • чип умови у формі «щоразу у Львові» (повтор живе у формулюванні умови),
//   • термінальна дія лише «відпустити» (без «виконано»).
// Локатив («Львові») виводиться на льоту зі словника демо-міст (CITY_LOCATIVE).

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntentCard } from "@/components/IntentCard";
import { describeCondition } from "@/lib/format";
import type { Condition } from "@/lib/types";

const LVIV: Condition = { type: "location", value: { city: "Львів" } };
const NOW = new Date(2026, 6, 20);

describe("describeCondition — рекурентний гео-чип", () => {
  it("рекурентний → «щоразу у Львові» (локатив на льоту)", () => {
    expect(describeCondition(LVIV, NOW, { recurring: true })).toBe("щоразу у Львові");
  });

  it("одноразовий гео → плоска назва міста (без «щоразу»)", () => {
    expect(describeCondition(LVIV, NOW)).toBe("Львів");
  });

  it("невідоме місто → запасний локатив «у місті ...»", () => {
    const unknown: Condition = { type: "location", value: { city: "Бровари" } };
    expect(describeCondition(unknown, NOW, { recurring: true })).toBe("щоразу у місті Бровари");
  });
});

describe("IntentCard — рекурентна гео-картка", () => {
  it("показує чип «щоразу у Львові»", () => {
    render(<IntentCard text="кава на Каві" priority="low" condition={LVIV} recurring now={NOW} />);
    expect(screen.getByText("щоразу у Львові")).toBeInTheDocument();
  });

  it("НЕ дає кнопки «Виконано» (галочкою не закрити)", () => {
    render(
      <IntentCard
        text="кава на Каві"
        priority="low"
        condition={LVIV}
        recurring
        now={NOW}
        onComplete={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Виконано")).not.toBeInTheDocument();
  });

  it("показує маркер повтору (Повторюється)", () => {
    render(<IntentCard text="кава на Каві" priority="low" condition={LVIV} recurring now={NOW} />);
    expect(screen.getByLabelText("Повторюється")).toBeInTheDocument();
  });

  it("нерекурентна гео-картка лишає плоску назву міста і тік «Виконано»", () => {
    render(
      <IntentCard
        text="аптека"
        priority="low"
        condition={LVIV}
        now={NOW}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText("Львів")).toBeInTheDocument();
    expect(screen.getByLabelText("Виконано")).toBeInTheDocument();
    expect(screen.queryByLabelText("Повторюється")).not.toBeInTheDocument();
  });
});
