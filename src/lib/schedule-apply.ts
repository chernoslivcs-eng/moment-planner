// Крок 7 · Ланка 3 — застосування розподілу до дедлайну.
//
// The bridge between the parse layer (Candidate[]) and the PURE distribution engine
// (lib/schedule.ts). It is itself pure (no store, no React): given the review-buffer candidates,
// the already-committed intents (the source of "occupied" hours) and the current time, it returns
// a NEW candidate array where every candidate carrying a `deadline` cutoff has been laid onto a
// concrete `datetime` hour before that cutoff — working around the occupied hours — and its
// transient `deadline` hint cleared. Overflow (didn't fit) is NOT dropped: it stays an
// unconditional `none` candidate so nothing silently vanishes. Non-deadline candidates pass
// through byte-identical.
//
// MODEL BOUNDARY: this never touches buildToday / holdsToday / isOverdue, and it does not harden
// the condition model. It only READS existing `datetime` intents as busy blocks and WRITES new
// `datetime` conditions onto distributed candidates. Everything else about the condition stays.

import type { Candidate, Intent, TimeValue } from "./types";
import { isSameLocalDay } from "./dates";
import { distributeByDeadline, type OccupiedSlot, type ScheduleTask } from "./schedule";

const MINUTE = 60_000;
// A committed intent with a concrete hour but no estimated duration still blocks a real chunk of
// the day — treat it (and any unestimated distributed task) as a 60-minute block.
const DEFAULT_BLOCK_MIN = 60;

// Local, zone-neutral ISO with no `Z`/offset — the exact shape the parser/normalizer store in
// `at` (see normalize.ts normalizeAt). Built from local components so a Date placed by the engine
// round-trips through `new Date(at)` (parseAt) to the same wall-clock hour.
function toNaiveISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

function datetimeCondition(start: Date): Candidate["condition"] {
  const value: TimeValue = {
    kind: "datetime",
    at: toNaiveISO(start),
    weekday: null,
    daypart: null,
  };
  return { type: "time", value };
}

// The busy blocks the engine must avoid: committed OPEN intents that name a concrete hour
// (`datetime`) on the same local day as `now`. A daypart/date/weekday/location/none intent has no
// precise hour and deliberately does NOT occupy a slot (contract boundary).
function occupiedFromIntents(intents: Intent[], now: Date): OccupiedSlot[] {
  const slots: OccupiedSlot[] = [];
  for (const i of intents) {
    if (i.status !== "open") continue;
    if (i.condition.type !== "time") continue;
    const v = i.condition.value;
    if (v.kind !== "datetime" || !v.at) continue;
    const start = new Date(v.at);
    if (Number.isNaN(start.getTime()) || !isSameLocalDay(start, now)) continue;
    const durMin = typeof i.duration === "number" ? i.duration : DEFAULT_BLOCK_MIN;
    slots.push({ start, end: new Date(start.getTime() + durMin * MINUTE) });
  }
  return slots;
}

export function scheduleDeadlineCandidates(
  candidates: Candidate[],
  existingIntents: Intent[],
  now: Date,
): Candidate[] {
  // Nothing to distribute → return the array untouched (identity, so callers can cheaply detect it).
  if (!candidates.some((c) => c.deadline)) return candidates;

  // Busy blocks from the committed backlog. Newly-placed tasks accumulate here so that, if the
  // stream carries more than one deadline group, later groups also route around earlier placements.
  const occupied = occupiedFromIntents(existingIntents, now);

  // Group deadline candidates by their cutoff, preserving in-group order (input order == the order
  // the person listed them, which the engine maps to chronological order). Process groups by
  // ascending deadline so earlier cutoffs claim their hours first.
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!c.deadline) continue;
    const arr = groups.get(c.deadline);
    if (arr) arr.push(c);
    else groups.set(c.deadline, [c]);
  }

  // cid → new condition (datetime when placed; absent when overflow → falls back to none).
  const placement = new Map<string, Candidate["condition"]>();
  const sortedDeadlines = [...groups.keys()].sort();
  for (const deadlineISO of sortedDeadlines) {
    const group = groups.get(deadlineISO)!;
    const deadline = new Date(deadlineISO);
    if (Number.isNaN(deadline.getTime())) continue; // unparsable cutoff → leave as none
    const tasks: ScheduleTask[] = group.map((c) => ({
      id: c.cid,
      duration: typeof c.duration === "number" ? c.duration : DEFAULT_BLOCK_MIN,
    }));
    const { placed } = distributeByDeadline({ tasks, deadline, now, occupied });
    for (const p of placed) {
      placement.set(p.id, datetimeCondition(p.start));
      // A placed task becomes a busy block for the next group.
      const durMin = tasks.find((t) => t.id === p.id)!.duration;
      occupied.push({ start: p.start, end: new Date(p.start.getTime() + durMin * MINUTE) });
    }
    // Overflow ids simply never get a placement → fall through to unconditional `none` below.
  }

  return candidates.map((c) => {
    if (!c.deadline) return c;
    const cond = placement.get(c.cid);
    // Placed → concrete datetime; overflow → stays unconditional `none`. Either way the transient
    // deadline hint is consumed so it never lingers on a committed intent.
    return { ...c, deadline: null, condition: cond ?? { type: "none" } };
  });
}
