"use client";

// Step 2 skeleton stub: «Заплановано» lists the open intents whose moment hasn't come
// yet — everything in the backlog that today's plan is NOT surfacing (neither active
// nor overdue). Read-only: it reuses buildToday purely to know what today already
// claims, then shows the rest as waiting cards. No new logic, no mutations here beyond
// the shared store helpers the other screens already use.

import { useEffect, useState } from "react";
import { IntentCard } from "@/components/IntentCard";
import { EmptyState } from "@/components/EmptyState";
import { currentContext } from "@/lib/conditions/context";
import { buildToday } from "@/lib/today";
import { useIntents } from "@/lib/store";
import type { Intent } from "@/lib/types";

export default function PlannedPage() {
  const intents = useIntents();
  const [waiting, setWaiting] = useState<Intent[]>([]);
  const now = new Date();

  // Re-derive on the same triggers as Today so the split stays consistent.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      buildToday(intents, currentContext()).then((view) => {
        if (cancelled) return;
        const surfaced = new Set([...view.active, ...view.overdue].map((i) => i.id));
        setWaiting(
          intents.filter((i) => i.status === "open" && !surfaced.has(i.id)),
        );
      });
    };
    run();
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [intents]);

  if (waiting.length === 0) {
    return (
      <main className="flex flex-1 flex-col">
        <EmptyState
          emoji="🗓️"
          title="Поки що нічого не чекає"
          hint="Наміри, чий момент ще попереду, збиратимуться тут — доки не настане їхній час."
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      <header className="mb-5 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          Не сьогодні
        </p>
        <h1 className="mt-2 font-display text-[33px] font-semibold leading-[1.05] tracking-tight text-ink">
          Заплановано
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
          Чекають свого моменту.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {waiting.map((intent) => (
          <IntentCard
            key={intent.id}
            text={intent.text}
            priority={intent.priority}
            condition={intent.condition}
            now={now}
            state="waiting"
          />
        ))}
      </div>
    </main>
  );
}
