// Step 1 — Intent model extension: two forward-looking fields (`recurring`, `duration`) added
// to the schema ahead of the features that will use them. This step is purely structural: the
// fields exist with defaults, a single normalization point back-fills a legacy localStorage
// backlog, and newly-created intents carry the defaults explicitly. NO behaviour reads them yet.

import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  __resetStoreForTests,
  commitAllCandidates,
  normalizeStoredIntent,
  replaceCandidates,
  useIntents,
} from "@/lib/store";
import type { Intent, ParsedIntent } from "@/lib/types";

const INTENTS_KEY = "mp.intents.v1";

beforeEach(() => {
  localStorage.clear();
  __resetStoreForTests();
});

describe("Intent model extension — recurring & duration", () => {
  describe("normalizeStoredIntent — the single back-fill point", () => {
    it("fills recurring=false and duration=null when a legacy intent lacks them", () => {
      // an intent as saved by an OLDER build — no recurring/duration keys at all
      const legacy = {
        id: "i_legacy",
        text: "подзвонити мамі",
        priority: "medium",
        status: "open",
        condition: { type: "none" },
        createdAt: "2026-07-01T10:00:00.000Z",
        todayOverride: null,
      };
      const full = normalizeStoredIntent(legacy as unknown as Intent);
      expect(full.recurring).toBe(false);
      expect(full.duration).toBeNull();
      // untouched fields survive verbatim
      expect(full.id).toBe("i_legacy");
      expect(full.text).toBe("подзвонити мамі");
      expect(full.condition).toEqual({ type: "none" });
    });

    it("preserves already-present recurring/duration values (no clobber)", () => {
      const already: Intent = {
        id: "i1",
        text: "тренування",
        priority: "high",
        status: "open",
        condition: { type: "none" },
        createdAt: "2026-07-01T10:00:00.000Z",
        todayOverride: null,
        recurring: true,
        duration: 45,
      };
      const full = normalizeStoredIntent(already);
      expect(full.recurring).toBe(true);
      expect(full.duration).toBe(45);
    });
  });

  describe("creation from a parsed candidate", () => {
    it("saves new intents with recurring=false and duration=null", () => {
      const parsed: ParsedIntent = {
        text: "купити квитки",
        priority: "medium",
        condition: { type: "none" },
      };
      replaceCandidates([parsed]);
      commitAllCandidates();

      const saved = JSON.parse(localStorage.getItem(INTENTS_KEY) ?? "[]") as Intent[];
      expect(saved).toHaveLength(1);
      expect(saved[0].recurring).toBe(false);
      expect(saved[0].duration).toBeNull();
    });
  });

  describe("loading a legacy backlog from localStorage", () => {
    it("back-fills defaults on load without dropping any intent", async () => {
      const legacy = [
        {
          id: "i_old",
          text: "стара справа",
          priority: "low",
          status: "open",
          condition: { type: "none" },
          createdAt: "2026-06-01T08:00:00.000Z",
          todayOverride: null,
        },
      ];
      localStorage.setItem(INTENTS_KEY, JSON.stringify(legacy));
      __resetStoreForTests();

      const { result } = renderHook(() => useIntents());
      await waitFor(() => expect(result.current).toHaveLength(1));
      expect(result.current[0].id).toBe("i_old");
      expect(result.current[0].recurring).toBe(false);
      expect(result.current[0].duration).toBeNull();
    });
  });
});
