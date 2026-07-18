import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/EmptyState";
import { IntentCard } from "@/components/IntentCard";
import type { Condition } from "@/lib/types";

describe("EmptyState", () => {
  it("renders the title and hint (Today's empty invitation)", () => {
    render(
      <EmptyState
        emoji="☀️"
        title="План на сьогодні з'явиться тут"
        hint="Запиши думки й підтверди розбір."
      />,
    );
    expect(screen.getByText("План на сьогодні з'явиться тут")).toBeInTheDocument();
    expect(screen.getByText(/Запиши думки/)).toBeInTheDocument();
  });
});

describe("IntentCard", () => {
  it("renders text, priority label and a time-condition label", () => {
    const condition: Condition = {
      type: "time",
      value: { kind: "daypart", at: null, weekday: null, daypart: "morning" },
    };
    render(<IntentCard text="подзвонити мамі" priority="high" condition={condition} />);
    expect(screen.getByText("подзвонити мамі")).toBeInTheDocument();
    expect(screen.getByText("Високий")).toBeInTheDocument();
    expect(screen.getByText("Зранку")).toBeInTheDocument();
  });
});
