// Крок 7 · Ланка 3 (натяк у розборі): deadline-кандидат у РОЗБОРІ ще не має конкретної години
// (годину дає коміт). Замість глухого «Будь-коли» картка показує намір-натяк: «до 20:00 ·
// розкладу по годинах» з годинником. Це ЛИШЕ презентація транзитного поля `deadline` — механіка
// розподілу (година призначається на «Підтвердити») не змінюється.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntentCard } from "@/components/IntentCard";
import { describeDeadline } from "@/lib/format";

const NOW = new Date(2026, 0, 5, 15, 0, 0);

describe("describeDeadline", () => {
  it("формує «до HH:MM · розкладу по годинах» із naive-ISO", () => {
    expect(describeDeadline("2026-01-05T20:00:00")).toBe("до 20:00 · розкладу по годинах");
  });

  it("тримає годину зона-нейтрально (18:00 → 18:00)", () => {
    expect(describeDeadline("2026-01-05T18:00:00")).toBe("до 18:00 · розкладу по годинах");
  });
});

describe("IntentCard — натяк на дедлайн у розборі", () => {
  it("deadline-кандидат показує підпис дедлайну, а не «Будь-коли»", () => {
    render(
      <IntentCard
        text="зустріч один"
        priority="medium"
        condition={{ type: "none" }}
        now={NOW}
        state="today"
        deadline="2026-01-05T20:00:00"
      />,
    );
    expect(screen.getByText("до 20:00 · розкладу по годинах")).toBeInTheDocument();
    expect(screen.queryByText("Будь-коли")).not.toBeInTheDocument();
  });

  it("без deadline картка показує звичайний підпис умови", () => {
    render(
      <IntentCard
        text="купити молоко"
        priority="low"
        condition={{ type: "none" }}
        now={NOW}
        state="today"
      />,
    );
    expect(screen.getByText("Будь-коли")).toBeInTheDocument();
    expect(screen.queryByText(/розкладу по годинах/)).not.toBeInTheDocument();
  });
});
