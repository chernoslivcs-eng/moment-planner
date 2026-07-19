"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ParseError, parseText } from "@/lib/api";
import { addCandidates } from "@/lib/store";
import { EXAMPLE_BRAINDUMP } from "@/lib/example";

export default function CapturePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canParse = text.trim().length >= 2 && !loading;

  async function handleParse() {
    if (!canParse) return;
    setLoading(true);
    setError(null);
    try {
      const intents = await parseText(text);
      if (intents.length === 0) {
        // Parsed fine but nothing meaningful — gently ask for more, keep the text.
        setError("Не вдалося виділити жодного наміру. Спробуй сформулювати конкретніше.");
        return;
      }
      addCandidates(intents);
      setText(""); // committed to the review buffer; clear the field
      router.push("/inbox");
    } catch (e) {
      // Text is NEVER lost — we only surface a message and leave the field intact.
      const message =
        e instanceof ParseError ? e.message : "Щось пішло не так. Спробуй ще раз.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      <header className="mb-6 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          Moment Planner
        </p>
        <h1 className="mt-2 font-display text-[33px] font-semibold leading-[1.05] tracking-tight text-ink">
          Що в голові?
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
          Пиши все підряд, потоком. Розберу на окремі наміри.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Напр.: до п'ятниці купити квитки, завтра зранку подзвонити мамі…"
        rows={7}
        className="w-full resize-none rounded-card border border-line bg-surface p-4 font-display text-[19px] leading-relaxed text-ink shadow-card outline-none placeholder:italic placeholder:text-ink-3 focus:border-clay-soft"
      />

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-soft border border-clay/25 bg-clay/8 p-3 text-sm text-ink-2">
          <span aria-hidden>⚠️</span>
          <div className="flex-1">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleParse}
              disabled={!canParse}
              className="mt-2 font-semibold text-clay underline underline-offset-2 disabled:opacity-50"
            >
              Спробувати ще раз
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleParse}
          disabled={!canParse}
          className="flex h-12 items-center justify-center rounded-card bg-clay px-6 text-[15px] font-semibold text-white shadow-[0_6px_18px_rgba(180,100,63,0.28)] transition active:scale-[0.99] disabled:opacity-40"
        >
          {loading ? "Розбираю…" : "Розібрати"}
        </button>
        <button
          type="button"
          onClick={() => {
            setText(EXAMPLE_BRAINDUMP);
            setError(null);
          }}
          disabled={loading}
          className="flex h-12 items-center justify-center rounded-card border border-line px-6 text-[15px] font-semibold text-ink-2 transition active:scale-[0.99] disabled:opacity-40"
        >
          Спробувати приклад
        </button>
      </div>
    </main>
  );
}
