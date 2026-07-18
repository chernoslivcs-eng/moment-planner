// Never trust the model's output (roadmap §4). Turn a dirty/partial model response into
// clean, schema-valid ParsedIntent[]: strip markdown, coerce bad fields, drop garbage.

import type { Daypart, ParsedIntent, Priority, TimeValue } from "../types";
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

function normalizeAt(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeTimeValue(raw: unknown, today: Date): TimeValue {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let kind = (TIME_KINDS as readonly string[]).includes(obj.kind as string)
    ? (obj.kind as TimeValue["kind"])
    : "date";
  const at = normalizeAt(obj.at);
  const weekday = toStr(obj.weekday);
  const daypart = normalizeDaypart(obj.daypart);

  // Repair contradictions: a dated kind with no valid `at` and no daypart falls back to
  // "сьогодні" so the intent still surfaces today rather than becoming invisible.
  if ((kind === "datetime" || kind === "date") && !at) {
    if (daypart) {
      kind = "daypart";
    } else if (weekday) {
      kind = "weekday";
    } else {
      return {
        kind: "date",
        at: startOfDayISO(today),
        weekday: null,
        daypart: null,
      };
    }
  }
  if (kind === "weekday" && !weekday) {
    return { kind: "date", at: startOfDayISO(today), weekday: null, daypart: null };
  }
  if (kind === "daypart" && !daypart) {
    return { kind: "date", at: startOfDayISO(today), weekday: null, daypart: null };
  }

  return { kind, at, weekday, daypart };
}

function startOfDayISO(today: Date): string {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export interface NormalizeOptions {
  today?: Date;
}

// Accepts a raw model string OR an already-parsed value. Returns clean intents.
// Throws ParseFormatError only when a string can't be located/parsed as a JSON array.
export function normalizeParseResponse(
  raw: unknown,
  opts: NormalizeOptions = {},
): ParsedIntent[] {
  const today = opts.today ?? new Date();
  const value = typeof raw === "string" ? extractJsonArray(raw) : raw;
  if (!Array.isArray(value)) return [];

  const out: ParsedIntent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const text = toStr(obj.text);
    if (!text) continue; // no text → nothing to keep; drop it

    const rawCondition = (obj.condition ?? {}) as Record<string, unknown>;
    // Core: condition.type is always coerced to "time".
    const timeVal = normalizeTimeValue(rawCondition.value, today);

    out.push({
      text,
      priority: normalizePriority(obj.priority),
      condition: { type: "time", value: timeVal },
    });
  }
  return out;
}
