"use client";

// Thin client wrapper over POST /api/parse. Maps server error codes to friendly messages.
// The caller is responsible for preserving the user's text (roadmap §4).

import type { ParsedIntent } from "./types";
import { localCalendarDate } from "./dates";

export type ParseErrorCode =
  | "empty"
  | "config"
  | "provider"
  | "format"
  | "network"
  | "unknown";

export class ParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = "ParseError";
    this.code = code;
  }
}

export async function parseText(text: string): Promise<ParsedIntent[]> {
  let res: Response;
  try {
    res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send the user's LOCAL calendar date (not a UTC instant): after midnight in a positive
      // offset zone, toISOString() reports the prior day, so «сьогодні» parsed onto «вчора».
      body: JSON.stringify({ text, today: localCalendarDate(new Date()) }),
    });
  } catch {
    throw new ParseError("network", "Немає зв'язку. Перевір інтернет і спробуй ще раз.");
  }

  let data: { intents?: ParsedIntent[]; code?: ParseErrorCode; message?: string } = {};
  try {
    data = await res.json();
  } catch {
    // fall through to status-based handling
  }

  if (res.ok && Array.isArray(data.intents)) {
    return data.intents;
  }

  const code: ParseErrorCode = data.code ?? "unknown";
  const message = data.message ?? "Щось пішло не так. Спробуй ще раз.";
  throw new ParseError(code, message);
}
