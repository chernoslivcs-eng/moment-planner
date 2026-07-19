"use client";

// localStorage-backed store for the demo (roadmap §1 technical bounds: data lives locally).
// Two separate collections:
//   - intents:    the committed backlog (Intent[]). status is human-only.
//   - candidates: the Inbox review buffer (Candidate[]) — parsed but not yet confirmed.
// Kept apart so "the user sees the breakdown BEFORE saving" is literal and Intent.status
// never carries a transient "pending" value.

import { useSyncExternalStore } from "react";
import type { Candidate, Intent, ParsedIntent, Status } from "./types";

const INTENTS_KEY = "mp.intents.v1";
const CANDIDATES_KEY = "mp.candidates.v1";

// In-memory source of truth. Starts empty so server render and first client render match;
// the real data is loaded from localStorage after mount (in the first subscribe).
let intents: Intent[] = [];
let candidates: Candidate[] = [];
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readKey<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function loadOnce() {
  if (loaded || typeof window === "undefined") return;
  intents = readKey<Intent>(INTENTS_KEY);
  candidates = readKey<Candidate>(CANDIDATES_KEY);
  loaded = true;
}

function persistIntents() {
  try {
    localStorage.setItem(INTENTS_KEY, JSON.stringify(intents));
  } catch {
    // demo scope: ignore quota/serialization failures
  }
}

function persistCandidates() {
  try {
    localStorage.setItem(CANDIDATES_KEY, JSON.stringify(candidates));
  } catch {
    // demo scope
  }
}

function subscribe(listener: () => void) {
  // First subscriber (client-only) loads persisted data, then notifies so views refresh.
  if (!loaded) {
    loadOnce();
    if (loaded) Promise.resolve().then(emit);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY_INTENTS: Intent[] = [];
const EMPTY_CANDIDATES: Candidate[] = [];

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Content identity of an intent/candidate: normalized text + the polymorphic condition.
// Re-parsing the same brain-dump yields the same signature, which is how we detect and
// drop duplicates before they ever reach a collection (fixes duplicate build-up in Today).
function signature(x: { text: string; condition: ParsedIntent["condition"] }): string {
  const text = x.text.trim().toLowerCase().replace(/\s+/g, " ");
  // "none" carries no value; other variants do. Guard the access so the union stays sound.
  const value = "value" in x.condition ? x.condition.value : null;
  return `${text}||${x.condition.type}||${JSON.stringify(value)}`;
}

// ---- Candidates (Inbox review buffer) --------------------------------------

// Replace the entire review buffer with a fresh parse. Every new brain-dump starts from
// a clean slate: any previous, still-unconfirmed candidates are discarded, so re-parsing
// the same text — or parsing a second stream before confirming the first — can't stack
// near-duplicate fragments (e.g. the whole «подзвонити мамі й привітати її» plus a later
// fragment «подзвонити мамі», which carry different signatures and both survive dedup).
// Duplicates WITHIN this one batch are still collapsed by signature.
export function replaceCandidates(parsed: ParsedIntent[]): void {
  const seen = new Set<string>();
  const next: Candidate[] = [];
  for (const p of parsed) {
    const sig = signature(p);
    if (seen.has(sig)) continue;
    seen.add(sig);
    next.push({ ...p, cid: newId("c") });
  }
  candidates = next;
  persistCandidates();
  emit();
}

export function removeCandidate(cid: string): void {
  candidates = candidates.filter((c) => c.cid !== cid);
  persistCandidates();
  emit();
}

export function toggleCandidatePinToday(cid: string): void {
  candidates = candidates.map((c) =>
    c.cid === cid ? { ...c, pinToday: !c.pinToday } : c,
  );
  persistCandidates();
  emit();
}

function candidateToIntent(c: Candidate, status: Status): Intent {
  return {
    id: newId("i"),
    text: c.text,
    priority: c.priority,
    status,
    condition: c.condition,
    createdAt: new Date().toISOString(),
    todayOverride: c.pinToday ? "in" : null,
  };
}

// Signatures of intents still open in the backlog — the set we must not duplicate into.
function openSignatures(): Set<string> {
  return new Set(intents.filter((i) => i.status === "open").map(signature));
}

// Commit one candidate into the backlog with an explicit status (open by default, or done).
export function commitCandidate(cid: string, status: Status = "open"): void {
  const c = candidates.find((x) => x.cid === cid);
  if (!c) return;
  // Drop it from the buffer regardless; only add to the backlog if it isn't already
  // an open intent (re-parsed duplicates confirm to a no-op instead of piling up).
  const isDuplicate = status === "open" && openSignatures().has(signature(c));
  candidates = candidates.filter((x) => x.cid !== cid);
  if (!isDuplicate) {
    intents = [candidateToIntent(c, status), ...intents];
    persistIntents();
  }
  persistCandidates();
  emit();
}

// Commit every remaining candidate as an open intent (the "Підтвердити" gate).
export function commitAllCandidates(): void {
  if (candidates.length === 0) return;
  const open = openSignatures();
  const materialized: Intent[] = [];
  for (const c of candidates) {
    const sig = signature(c);
    if (open.has(sig)) continue; // already an open intent — don't duplicate into Today
    open.add(sig);
    materialized.push(candidateToIntent(c, "open"));
  }
  if (materialized.length > 0) {
    intents = [...materialized, ...intents];
    persistIntents();
  }
  candidates = [];
  persistCandidates();
  emit();
}

// ---- Intents (committed backlog) -------------------------------------------

export function setIntentStatus(id: string, status: Status): void {
  intents = intents.map((i) => (i.id === id ? { ...i, status } : i));
  persistIntents();
  emit();
}

export function setTodayOverride(id: string, value: Intent["todayOverride"]): void {
  intents = intents.map((i) => (i.id === id ? { ...i, todayOverride: value } : i));
  persistIntents();
  emit();
}

// ---- React bindings --------------------------------------------------------

export function useIntents(): Intent[] {
  return useSyncExternalStore(
    subscribe,
    () => intents,
    () => EMPTY_INTENTS,
  );
}

export function useCandidates(): Candidate[] {
  return useSyncExternalStore(
    subscribe,
    () => candidates,
    () => EMPTY_CANDIDATES,
  );
}

// Test-only reset (not used in the app).
export function __resetStoreForTests(): void {
  intents = [];
  candidates = [];
  loaded = false;
}
