// Розподіл задач до дедлайну (Ланка 2 — «серце»). A PURE, framework-free function that takes a
// list of tasks-to-distribute (each with a duration), a deadline (the cutoff hour), the current
// time, and a list of ALREADY-occupied slots, and lays the tasks onto concrete hours BEFORE the
// deadline, working around the occupied slots.
//
// DELIBERATE MODEL BOUNDARY: this module knows nothing about Intent/Condition. It never touches
// buildToday / holdsToday / isOverdue. Its ONLY job is arithmetic on time windows. The caller
// (Ланка 3) is responsible for turning a placement into a `datetime` time-condition, and for
// deciding WHICH today-intents count as "occupied" (only those with a concrete hour — `datetime`).
//
// Algorithm — backward packing from the deadline:
//   • The LAST task in the list ends exactly at the deadline; each earlier task ends where the
//     next one starts. This keeps input order == chronological order (first-said is earliest).
//   • A task that would overlap an occupied slot is shifted earlier to the nearest free window.
//   • Nothing is ever scheduled before `now` (no travel into the past).
//   • Tasks that cannot fit before the deadline are NOT silently dropped — they are returned in
//     `overflow` so the UI can say «не вмістилось до дедлайну».

export interface ScheduleTask {
  id: string;
  duration: number; // minutes; callers resolve a null estimate to a default before calling
}

// A window already taken by something with a concrete hour (a `datetime` intent). Half-open
// [start, end): a task may END exactly at `start` or START exactly at `end` without conflict.
export interface OccupiedSlot {
  start: Date;
  end: Date;
}

export interface ScheduledPlacement {
  id: string;
  start: Date;
  end: Date;
}

export interface ScheduleResult {
  placed: ScheduledPlacement[]; // chronological order (earliest first)
  overflow: string[]; // ids that did not fit, in original input order
}

export interface ScheduleInput {
  tasks: ScheduleTask[];
  deadline: Date;
  now: Date;
  occupied: OccupiedSlot[];
}

const MINUTE = 60_000;

// Two half-open intervals overlap iff each starts strictly before the other ends. A shared
// boundary (aEnd === bStart) is NOT an overlap.
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Find the LATEST start s such that [s, s+dur) ends at or before `end`, starts at or after
// `nowMs`, and overlaps none of the (sorted-by-start) occupied windows. Returns null if no such
// slot exists (the task overflows). We walk downward: whenever the candidate collides with an
// occupied window, we drop `end` to that window's start and retry — `end` strictly decreases, so
// the loop terminates.
function findLatestFreeStart(
  end: number,
  durMs: number,
  nowMs: number,
  occupied: { start: number; end: number }[],
): number | null {
  let cursorEnd = end;
  // Bounded by the number of occupied windows we can bump past, plus one.
  for (let guard = 0; guard <= occupied.length; guard++) {
    const start = cursorEnd - durMs;
    if (start < nowMs) return null;
    // Earliest occupied window this candidate collides with — jump the whole task before it.
    let collision: { start: number; end: number } | null = null;
    for (const o of occupied) {
      if (overlaps(start, cursorEnd, o.start, o.end)) {
        if (!collision || o.start < collision.start) collision = o;
      }
    }
    if (!collision) return start;
    cursorEnd = collision.start;
  }
  return null;
}

export function distributeByDeadline(input: ScheduleInput): ScheduleResult {
  const nowMs = input.now.getTime();
  const deadlineMs = input.deadline.getTime();

  // Normalize occupied windows to numeric ms and sort by start for deterministic collision pick.
  const occupied = input.occupied
    .map((o) => ({ start: o.start.getTime(), end: o.end.getTime() }))
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start - b.start);

  const placed: ScheduledPlacement[] = [];
  const overflow: string[] = [];

  // `cursor` is the latest instant the next (earlier) task may end at. It starts at the deadline
  // and drops to the start of each successfully-placed task, so placed tasks never overlap each
  // other and stay in chronological order. We walk the input BACKWARD (last task hugs deadline).
  let cursor = deadlineMs;
  for (let i = input.tasks.length - 1; i >= 0; i--) {
    const t = input.tasks[i];
    const durMs = t.duration * MINUTE;
    const start = findLatestFreeStart(cursor, durMs, nowMs, occupied);
    if (start === null) {
      // Doesn't fit before its cursor — overflow it, but keep trying earlier/smaller tasks.
      overflow.push(t.id);
      continue;
    }
    placed.push({ id: t.id, start: new Date(start), end: new Date(start + durMs) });
    cursor = start;
  }

  // `placed` was built latest-first; return it earliest-first. `overflow` was built walking
  // backward too, so reverse it to restore original input order.
  placed.reverse();
  overflow.reverse();
  return { placed, overflow };
}
