// POST /api/parse — the single server endpoint (roadmap §4). Takes raw text + today's date,
// calls the model through the provider (OpenRouter), validates/normalizes the response, and
// returns clean intents. The API key never reaches the browser or git — this route is the proxy.

import { NextResponse } from "next/server";
import { ParseFormatError, normalizeParseResponse } from "@/lib/parse/normalize";
import { ProviderError, callModel } from "@/lib/parse/provider";

export const runtime = "nodejs";

interface ParseRequest {
  text?: unknown;
  today?: unknown;
}

export async function POST(req: Request) {
  let body: ParseRequest;
  try {
    body = (await req.json()) as ParseRequest;
  } catch {
    return NextResponse.json(
      { code: "bad_request", message: "Щось не так із запитом. Спробуй ще раз." },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  // Empty / meaningless input → gentle, not an error (roadmap §4).
  if (text.length < 2) {
    return NextResponse.json(
      { code: "empty", message: "Напиши трохи більше — і я розберу." },
      { status: 422 },
    );
  }

  // Client passes its own "today" so relative dates resolve against the user's day.
  const todayDate = typeof body.today === "string" ? new Date(body.today) : new Date();
  const today = Number.isNaN(todayDate.getTime()) ? new Date() : todayDate;
  const todayISODate = today.toISOString().slice(0, 10);

  // One retry on unparseable output (roadmap §4: "повторний запит або чесне повідомлення").
  let lastFormatError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await callModel(text, todayISODate);
    } catch (e) {
      if (e instanceof ProviderError) {
        const status = e.kind === "config" ? 500 : 502;
        return NextResponse.json({ code: e.kind, message: providerMessage(e) }, { status });
      }
      return NextResponse.json(
        { code: "unknown", message: "Щось збоїло на моєму боці. Спробуй ще раз." },
        { status: 500 },
      );
    }

    try {
      const intents = normalizeParseResponse(raw, { today });
      return NextResponse.json({ intents });
    } catch (e) {
      if (e instanceof ParseFormatError) {
        lastFormatError = e;
        continue; // retry once
      }
      throw e;
    }
  }

  // Both attempts produced unreadable output — honest message; client keeps the user's text.
  return NextResponse.json(
    {
      code: "format",
      message: "Не вдалося розкласти це на наміри. Спробуй ще раз.",
      detail: lastFormatError instanceof Error ? lastFormatError.message : undefined,
    },
    { status: 502 },
  );
}

function providerMessage(e: ProviderError): string {
  return e.kind === "config"
    ? "Розбір поки недоступний. Спробуй трохи згодом."
    : "Не можу зараз розібрати — спробуй за хвилину.";
}
