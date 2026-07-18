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
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Moment Planner
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">Що в голові?</h1>
        <p className="mt-1 text-sm text-stone-500">
          Пиши все підряд, потоком. Розберу на окремі наміри.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Напр.: до п'ятниці купити квитки, завтра зранку подзвонити мамі…"
        rows={7}
        className="w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 text-[15px] leading-relaxed text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-stone-400"
      />

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          <span aria-hidden>⚠️</span>
          <div className="flex-1">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleParse}
              disabled={!canParse}
              className="mt-2 font-medium underline underline-offset-2 disabled:opacity-50"
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
          className="flex h-12 items-center justify-center rounded-full bg-stone-900 px-6 text-[15px] font-medium text-white transition active:scale-[0.99] disabled:opacity-40"
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
          className="flex h-12 items-center justify-center rounded-full border border-stone-300 px-6 text-[15px] font-medium text-stone-700 transition active:scale-[0.99] disabled:opacity-40"
        >
          Спробувати приклад
        </button>
      </div>
    </main>
  );
}
