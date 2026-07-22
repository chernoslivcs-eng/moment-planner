// The single localStorage flag gating the first-run onboarding overlay. Deliberately kept OUT
// of the main store (a forbidden zone): this is pure UI state — read once on open, written once
// when the user finishes or skips. Following the app's `mp.*.v1` key convention. Every access is
// guarded so SSR / private-mode / quota failures degrade to "show the onboarding" rather than throw.

const ONBOARDING_SEEN_KEY = "mp.onboarding.seen.v1";

// True only when the user has completed OR skipped the onboarding at least once. Any failure to
// read (no window, storage blocked) returns false, so the worst case is showing it again — never
// a crash and never silently hiding it.
export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Set by «Пропустити» and «Розпочати» — the two exits that count as "seen". Replay does NOT call
// this (it re-shows the overlay without ever clearing the flag), so replaying can't cause the
// onboarding to auto-appear on the next open.
export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    // demo scope: ignore quota/availability — worst case the overlay shows once more
  }
}

// Test-only: clear the flag so a spec can assert the first-run path. Not used by the app.
export function __resetOnboardingForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_SEEN_KEY);
  } catch {
    /* ignore */
  }
}
