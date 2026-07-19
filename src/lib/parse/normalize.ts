// Never trust the model's output (roadmap §4). Turn a dirty/partial model response into
// clean, schema-valid ParsedIntent[]: strip markdown, coerce bad fields, drop garbage.

import type { Condition, Daypart, ParsedIntent, Priority, TimeValue } from "../types";
import { DAYPARTS, PRIORITIES, TIME_KINDS } from "../types";

// Thrown when the response can't be located/parsed as JSON at all (caller shows a friendly error).
export class ParseFormatError extends Error {
  constructor(message = "Не вдалося прочитати відповідь у форматі JSON") {
    super(message);
    this.name = "ParseFormatError";
  }
}

// Pull a JSON array out of raw model text: strips ``` fences and any preamble/epilogue.
export function extractJsonArray(text: string): unknown {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new ParseFormatError();
  }
  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    throw new ParseFormatError();
  }
}

function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function normalizePriority(v: unknown): Priority {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v)
    ? (v as Priority)
    : "medium";
}

function normalizeDaypart(v: unknown): Daypart | null {
  return typeof v === "string" && (DAYPARTS as readonly string[]).includes(v)
    ? (v as Daypart)
    : null;
}

// Wall-clock, zone-neutral. The model returns the time exactly as the user said it —
// "18:00" with no timezone — and we must keep it that way. The old code did
// `new Date(s).toISOString()`, which anchors a naive string to the RUNTIME's timezone and
// re-emits UTC: on a UTC server (Vercel) "18:00" froze as 18:00Z, then a Kyiv browser
// rendered it as 21:00 (the +3 bug). Locally it was invisible because server and browser
// shared the Kyiv zone and the two shifts cancelled.
//
// Fix: read the wall-clock components literally (regex, no Date()/toISOString round-trip)
// and store a naive ISO string with no `Z`/offset. No timezone math ever touches the value,
// so the stored hour is byte-identical regardless of where the parse runs. A UTC probe via
// Date.UTC (which ignores the runtime zone) only validates that the components form a real
// calendar moment; it never influences the output.
function normalizeAt(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mi = "00", ss = "00"] = m;
  const probe = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss));
  // Reject impossible dates (e.g. month 13, day 32) — Date.UTC rolls them over.
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== +y ||
    probe.getUTCMonth() !== +mo - 1 ||
    probe.getUTCDate() !== +d
  ) {
    return null;
  }
  return `${y}-${mo}-${d}T${hh}:${mi}:${ss}`;
}

// Turns a raw condition into a clean one. Only "time" and "none" are produced by the core.
// A time condition that carries NO usable time information (no valid `at`, no weekday, no
// daypart) is NOT fabricated into "сьогодні" — it collapses to an unconditional "none".
// Anything unsupported (e.g. a reserved "location") with no time info likewise → "none".
function normalizeCondition(raw: unknown): Condition {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (obj.type === "none") return { type: "none" };

  const value = normalizeTimeValue(obj.value);
  return value ? { type: "time", value } : { type: "none" };
}

// Returns a clean TimeValue, or null when the model named no usable time at all
// (the caller turns null into an unconditional "none" — never a fabricated today).
function normalizeTimeValue(raw: unknown): TimeValue | null {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let kind = (TIME_KINDS as readonly string[]).includes(obj.kind as string)
    ? (obj.kind as TimeValue["kind"])
    : "date";
  const at = normalizeAt(obj.at);
  const weekday = toStr(obj.weekday);
  const daypart = normalizeDaypart(obj.daypart);

  // A dated kind with no valid `at` degrades to whatever softer time info exists;
  // if there is none, there is no time at all → null (caller makes it "none").
  if ((kind === "datetime" || kind === "date") && !at) {
    if (daypart) {
      kind = "daypart";
    } else if (weekday) {
      kind = "weekday";
    } else {
      return null;
    }
  }
  if (kind === "weekday" && !weekday) return null;
  if (kind === "daypart" && !daypart) return null;

  return { kind, at, weekday, daypart };
}

export interface NormalizeOptions {
  // Retained for API stability; time normalization no longer needs a "today" anchor
  // (relative dates are resolved by the model against the date passed in the prompt).
  today?: Date;
}

// Accepts a raw model string OR an already-parsed value. Returns clean intents.
// Throws ParseFormatError only when a string can't be located/parsed as a JSON array.
export function normalizeParseResponse(
  raw: unknown,
  _opts: NormalizeOptions = {},
): ParsedIntent[] {
  const value = typeof raw === "string" ? extractJsonArray(raw) : raw;
  if (!Array.isArray(value)) return [];

  const out: ParsedIntent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const text = toStr(obj.text);
    if (!text) continue; // no text → nothing to keep; drop it

    out.push({
      text,
      priority: normalizePriority(obj.priority),
      // Core produces "time" (a named moment) or "none" (unconditional). No today-default.
      condition: normalizeCondition(obj.condition),
    });
  }
  return out;
}
