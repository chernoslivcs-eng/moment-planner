"use client";

import { useEffect, useState } from "react";
import { IntentCard } from "@/components/IntentCard";
import { EmptyState } from "@/components/EmptyState";
import { ActionButton } from "@/components/ActionButton";
import { useCaptureSheet } from "@/components/CaptureSheet";
import { currentContext } from "@/lib/conditions/context";
import { buildToday, type TodayView } from "@/lib/today";
import { pluralizeIntents } from "@/lib/format";
import { setIntentStatus, setTodayOverride, useIntents } from "@/lib/store";

export default function TodayPage() {
  const intents = useIntents();
  const { open } = useCaptureSheet();
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
            <button
              type="button"
              onClick={open}
              className="mt-2 rounded-card bg-clay px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(180,100,63,0.28)]"
            >
              Записати думки
            </button>
          }
        />
      </main>
    );
  }

  // Live italic subtitle (prototype `.date`): weekday + day + month — surfaced-intent count.
  // Date is the browser-local wall day; count is the active («Сьогодні») intents.
  const activeCount = view.active.length;
  const dayLabel = new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const daySubtitle = `${dayLabel} — виринуло ${activeCount} ${pluralizeIntents(activeCount)}`;

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      <header className="mb-5 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          План на дію
        </p>
        <h1 className="mt-2 font-display text-[33px] font-semibold leading-[1.05] tracking-tight text-ink">
          Сьогодні
        </h1>
        <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-ink-2">
          {daySubtitle}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {view.active.map((intent) => (
          <IntentCard
            key={intent.id}
            text={intent.text}
            priority={intent.priority}
            condition={intent.condition}
            now={now}
            state="today"
            onComplete={() => setIntentStatus(intent.id, "done")}
            onDismiss={() => setTodayOverride(intent.id, "out")}
          />
        ))}
      </div>

      {view.overdue.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2.5 px-1 text-[12px] font-semibold uppercase tracking-[0.13em] text-ink-3">
            <span>Момент, здається, минув</span>
            <span className="h-px flex-1 bg-line-soft" />
          </h2>
          <div className="flex flex-col gap-3">
            {view.overdue.map((intent) => (
              <IntentCard
                key={intent.id}
                text={intent.text}
                priority={intent.priority}
                condition={intent.condition}
                now={now}
                state="gone"
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
