"use client";

// Mounts the first-run onboarding over the whole app and exposes a `replay()` for the "як це
// працює?" link in Today's empty state. Mirrors the existing provider pattern (CaptureSheet /
// IntentEditor). The overlay is client-only state: it renders nothing on the server and on the
// first client paint (open=false), then a mount effect opens it when the "seen" flag is absent —
// so there is no hydration mismatch and no flash of the overlay for returning users.

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { Onboarding } from "@/components/Onboarding";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";

type OnboardingContextValue = { replay: () => void };

// Default is a no-op so components rendered WITHOUT the provider (e.g. isolated unit tests of the
// Today page) can still call `useOnboarding().replay` harmlessly.
const OnboardingContext = createContext<OnboardingContextValue>({ replay: () => {} });

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

// The "seen" flag never changes underneath us (only our own actions write it, and we drive the
// overlay via local `override` state), so the subscription is a no-op — useSyncExternalStore here
// is used purely for its hydration-safe server/client snapshot split, the same pattern as store.ts.
const subscribeNoop = () => () => {};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Server + first hydration paint: treat as "seen" so the overlay renders nothing and can't
  // mismatch. After mount React re-reads the client snapshot (the real localStorage flag) — no
  // effect, no synchronous setState, no hydration warning.
  const seen = useSyncExternalStore(subscribeNoop, hasSeenOnboarding, () => true);

  // Manual open/close overrides the flag-derived default: null = follow the flag, true = replay,
  // false = dismissed this session.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? !seen;

  // «Пропустити» / «Розпочати» — the two exits that persist "seen" and close the overlay.
  const dismiss = () => {
    markOnboardingSeen();
    setOverride(false);
  };

  // Replay from the empty-state link: re-show WITHOUT clearing the flag, so it won't auto-appear
  // on the next app open. Finishing a replay runs `dismiss` again (idempotent).
  const replay = () => setOverride(true);

  return (
    <OnboardingContext.Provider value={{ replay }}>
      {children}
      {open ? <Onboarding onDone={dismiss} /> : null}
    </OnboardingContext.Provider>
  );
}
