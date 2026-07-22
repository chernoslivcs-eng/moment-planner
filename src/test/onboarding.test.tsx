// Feat/onboarding — first-run tour. Covers the three seams unit tests can actually see:
//   1. the localStorage "seen" flag (first run shows / repeat hides / skip+start persist),
//   2. the deck renders all four slides with the post-geo-merge copy,
//   3. finishing/skipping dismisses the overlay to reveal the app (transition to Today),
//   4. the empty-state "як це працює?" replay re-opens WITHOUT clearing the flag.
// The parser/store/condition core is untouched, so nothing here reaches into that logic.

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OnboardingProvider, useOnboarding } from "@/components/OnboardingProvider";
import { ONBOARDING_SLIDES } from "@/components/Onboarding";
import {
  __resetOnboardingForTests,
  hasSeenOnboarding,
  markOnboardingSeen,
} from "@/lib/onboarding";

beforeEach(() => {
  __resetOnboardingForTests();
});

// Walk the deck from the intro to the final «Розпочати».
function finishTour() {
  fireEvent.click(screen.getByRole("button", { name: "Далі" })); // intro → deck (slide 0)
  fireEvent.click(screen.getByRole("button", { name: "Далі" })); // 0 → 1
  fireEvent.click(screen.getByRole("button", { name: "Далі" })); // 1 → 2
  fireEvent.click(screen.getByRole("button", { name: "Далі" })); // 2 → 3 (last)
  fireEvent.click(screen.getByRole("button", { name: "Розпочати" }));
}

describe("onboarding flag (mp.onboarding.seen.v1)", () => {
  it("is unset on a clean first run", () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it("markOnboardingSeen persists across reads", () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });
});

describe("OnboardingProvider — first run vs repeat", () => {
  it("shows the overlay on first run (no flag)", () => {
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Не список справ.")).toBeInTheDocument();
  });

  it("does NOT show the overlay when already seen", () => {
    markOnboardingSeen();
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("APP")).toBeInTheDocument();
  });

  it("«Пропустити» sets the flag and dismisses to the app", () => {
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    // Intro skip is available immediately.
    fireEvent.click(screen.getByRole("button", { name: "Пропустити" }));
    expect(hasSeenOnboarding()).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("APP")).toBeInTheDocument();
  });

  it("«Розпочати» on the last slide sets the flag and reveals the app (→ Today)", () => {
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    finishTour();
    expect(hasSeenOnboarding()).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("APP")).toBeInTheDocument();
  });
});

describe("Onboarding deck — four slides, post-merge copy", () => {
  it("exports exactly four slides", () => {
    expect(ONBOARDING_SLIDES).toHaveLength(4);
  });

  it("renders every slide's title into the deck", () => {
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Далі" })); // → deck
    for (const s of ONBOARDING_SLIDES) {
      expect(screen.getByText(s.title)).toBeInTheDocument();
    }
  });

  it("slide 03 uses the version-B place copy (autosurfacing is live)", () => {
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Далі" }));
    expect(
      screen.getByText("Скажи місто — і намір сам вирине, коли ти там опинишся."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Приїхав у Львів — воно вже в «Сьогодні»\./)).toBeInTheDocument();
  });

  it("slide 02 chip is dateless («Середа, 15:00»), not «22 липня»", () => {
    render(
      <OnboardingProvider>
        <div>APP</div>
      </OnboardingProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Далі" }));
    expect(screen.getByText("Середа, 15:00")).toBeInTheDocument();
    expect(screen.queryByText(/22 липня/)).not.toBeInTheDocument();
  });

  it("«вирине» is spelled with Cyrillic letters (no Latin 'e')", () => {
    // Guard against the reference's Latin-е bug: the exact Cyrillic string must be found.
    for (const s of ONBOARDING_SLIDES) {
      expect(s.note.includes("виринe")).toBe(false); // Latin e
      expect(s.desc.includes("виринe")).toBe(false);
    }
    // And the real note is present verbatim.
    expect(ONBOARDING_SLIDES[1].note).toContain("сам вирине свого дня");
  });
});

// Consumer that re-opens the tour via the shared hook (mirrors Today's empty-state link).
function ReplayHarness() {
  const { replay } = useOnboarding();
  return (
    <button type="button" onClick={replay}>
      як це працює?
    </button>
  );
}

describe("replay — re-open without clearing the flag", () => {
  it("a seen user can re-open the tour, and the flag stays set", () => {
    markOnboardingSeen();
    render(
      <OnboardingProvider>
        <ReplayHarness />
      </OnboardingProvider>,
    );
    // Seen → no overlay initially.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "як це працює?" }));
    // Re-opened…
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // …and the flag was never cleared.
    expect(hasSeenOnboarding()).toBe(true);
  });
});
