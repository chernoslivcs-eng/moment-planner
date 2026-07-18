// SINGLE POINT for the LLM transport. Only the parsing *transport* lives here — the prompt,
// normalization and validation are provider-agnostic and stay put. To switch providers,
// change ACTIVE_PROVIDER (and the matching env key); nothing else in the app changes.
//
// Currently OpenRouter (OpenAI-compatible), because direct Anthropic billing failed for a
// Ukrainian card. The Anthropic path is implemented too (plain fetch, no SDK), so flipping
// back later is a one-line change once a direct balance exists.

import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export type Provider = "openrouter" | "anthropic";

export const ACTIVE_PROVIDER: Provider = "openrouter";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Haiku slug per provider. OpenRouter model can be overridden via env without code changes.
const MODEL: Record<Provider, string> = {
  openrouter: process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5",
  anthropic: "claude-haiku-4-5",
};

export type ProviderErrorKind = "config" | "provider";

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status?: number;
  constructor(kind: ProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
  }
}

// Returns the raw model text (expected to be a JSON array; validated downstream).
export async function callModel(text: string, todayISODate: string): Promise<string> {
  const user = buildUserPrompt(text, todayISODate);
  switch (ACTIVE_PROVIDER) {
    case "openrouter":
      return callOpenRouter(SYSTEM_PROMPT, user);
    case "anthropic":
      return callAnthropic(SYSTEM_PROMPT, user);
  }
}

async function callOpenRouter(system: string, user: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new ProviderError("config", "OPENROUTER_API_KEY не налаштований на сервері");
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://moment-planner.local",
        "X-Title": "Moment Planner",
      },
      body: JSON.stringify({
        model: MODEL.openrouter,
        temperature: 0,
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    throw new ProviderError("provider", `Мережева помилка: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const detail = await safeText(res);
    throw new ProviderError("provider", `OpenRouter ${res.status}: ${detail}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ProviderError("provider", "Порожня відповідь від OpenRouter");
  }
  return content;
}

// Kept ready for a future switch back to direct Anthropic (no SDK dependency).
async function callAnthropic(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ProviderError("config", "ANTHROPIC_API_KEY не налаштований на сервері");
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL.anthropic,
        max_tokens: 1024,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    throw new ProviderError("provider", `Мережева помилка: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const detail = await safeText(res);
    throw new ProviderError("provider", `Anthropic ${res.status}: ${detail}`, res.status);
  }

  const data = (await res.json()) as { content?: { text?: string }[] };
  const content = data.content?.[0]?.text;
  if (typeof content !== "string") {
    throw new ProviderError("provider", "Порожня відповідь від Anthropic");
  }
  return content;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "(no body)";
  }
}
