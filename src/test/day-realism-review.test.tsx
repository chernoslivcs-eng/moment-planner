// Крок 5 · Ланка 3 — Тривалість у Розборі: тихі пресети (—/15хв/30/1год/2+), не числове поле.
// Це ПРЕЗЕНТАЦІЯ наявного поля duration, а не нова механіка: у місці, де намір показано для
// підтвердження (CaptureSheet → ReviewStep), тривалість видно й можна змінити пресетом.
// setCandidateDuration оновлює кандидата (приймає лише пресет або null); обраний пресет доходить
// до збереженого наміру при підтвердженні.

import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { DurationPresets } from "@/components/DurationPresets";
import {
  __resetStoreForTests,
  commitAllCandidates,
  replaceCandidates,
  setCandidateDuration,
  useCandidates,
} from "@/lib/store";
import { renderHook } from "@testing-library/react";
import type { Intent, ParsedIntent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";

function parsed(over: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    text: "зустріч",
    priority: "medium",
    recurring: false,
    condition: { type: "none" },
    duration: null,
    ...over,
  };
}

describe("DurationPresets — тихі пресети (не числове поле)", () => {
  it("показує всі пресети: —, 15 хв, 30 хв, 1 год, 2+", () => {
    render(<DurationPresets value={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "—" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15 хв" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 хв" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 год" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2+" })).toBeInTheDocument();
  });

  it("активний пресет позначено (aria-pressed)", () => {
    render(<DurationPresets value={60} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1 год" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "30 хв" })).toHaveAttribute("aria-pressed", "false");
  });

  it("клік по пресету → onChange з його значенням", () => {
    const calls: (number | null)[] = [];
    render(<DurationPresets value={null} onChange={(v) => calls.push(v)} />);
    screen.getByRole("button", { name: "30 хв" }).click();
    screen.getByRole("button", { name: "2+" }).click();
    screen.getByRole("button", { name: "—" }).click();
    expect(calls).toEqual([30, 120, null]);
  });
});

describe("setCandidateDuration — оновлення кандидата у розборі", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStoreForTests();
  });

  it("встановлює duration кандидата за cid", () => {
    replaceCandidates([parsed()]);
    const { result } = renderHook(() => useCandidates());
    const cid = result.current[0].cid;
    act(() => setCandidateDuration(cid, 30));
    expect(result.current[0].duration).toBe(30);
  });

  it("скидання в null працює", () => {
    replaceCandidates([parsed({ duration: 60 })]);
    const { result } = renderHook(() => useCandidates());
    const cid = result.current[0].cid;
    act(() => setCandidateDuration(cid, null));
    expect(result.current[0].duration).toBeNull();
  });

  it("значення поза набором ігнорується (лишається як було)", () => {
    replaceCandidates([parsed({ duration: 60 })]);
    const { result } = renderHook(() => useCandidates());
    const cid = result.current[0].cid;
    setCandidateDuration(cid, 45);
    expect(result.current[0].duration).toBe(60);
  });

  it("обраний у розборі пресет доходить до збереженого наміру", () => {
    replaceCandidates([parsed()]);
    const { result } = renderHook(() => useCandidates());
    setCandidateDuration(result.current[0].cid, 120);
    commitAllCandidates();
    const saved = JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
    expect(saved[0].duration).toBe(120);
  });
});
