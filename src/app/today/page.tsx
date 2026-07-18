"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IntentCard } from "@/components/IntentCard";
import { EmptyState } from "@/components/EmptyState";
import { ActionButton } from "@/components/ActionButton";
import { currentContext } from "@/lib/conditions/context";
import { buildToday, type TodayView } from "@/lib/today";
import { setIntentStatus, setTodayOverride, useIntents } from "@/lib/store";

export default function TodayPage() {
  const intents = useIntents();
  const [view, setView] = useState<TodayView>({ active: [], overdue: [] });
  const now = new Date();

  // Re-evaluate on every trigger (mount, tab focus, visibility) — never a one-shot compute
  // at startup (roadmap §2, requirement 3). Membership is derived fresh each time.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      buildToday(intents, currentContext()).then((v) => {
        if (!cancelled) setView(v);
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

  const isEmpty = view.active.length === 0 && view.overdue.length === 0;

  if (isEmpty) {
    return (
      <main className="flex flex-1 flex-col">
        <EmptyState
          emoji="☀️"
          title="План на сьогодні з'явиться тут"
          hint="Запиши думки й підтверди розбір — наміри, чий час — сьогодні, зберуться в цей список."
          action={
            <Link
              href="/"
              className="mt-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Записати думки
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-stone-900">Сьогодні</h1>
        <p className="mt-1 text-sm text-stone-500">Твій план на день.</p>
      </header>

      <div className="flex flex-col gap-3">
        {view.active.map((intent) => (
          <IntentCard
            key={intent.id}
            text={intent.text}
            priority={intent.priority}
            condition={intent.condition}
            now={now}
            actions={
              <>
                <ActionButton onClick={() => setIntentStatus(intent.id, "done")}>
                  ✓ Виконано
                </ActionButton>
                <ActionButton
                  tone="danger"
                  onClick={() => setIntentStatus(intent.id, "released")}
                >
                  Відпустити
                </ActionButton>
                <ActionButton tone="neutral" onClick={() => setTodayOverride(intent.id, "out")}>
                  Прибрати з сьогодні
                </ActionButton>
              </>
            }
          />
        ))}
      </div>

      {view.overdue.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-stone-400">
            Момент, здається, минув
          </h2>
          <div className="flex flex-col gap-3">
            {view.overdue.map((intent) => (
              <IntentCard
                key={intent.id}
                text={intent.text}
                priority={intent.priority}
                condition={intent.condition}
                now={now}
                muted
                actions={
                  <>
                    <ActionButton
                      tone="danger"
                      onClick={() => setIntentStatus(intent.id, "released")}
                    >
                      Відпустити
                    </ActionButton>
                    <ActionButton
                      tone="accent"
                      onClick={() => setTodayOverride(intent.id, "in")}
                    >
                      Повернути в сьогодні
                    </ActionButton>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
