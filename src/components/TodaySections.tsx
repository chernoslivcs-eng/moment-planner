"use client";

// Крок 3 · Ланка 1 — Ієрархія «Сьогодні». PURELY PRESENTATIONAL: it takes the already-built
// TodayView and lays its intents into reading order — «Готове до дії» (moment-based conditions,
// time/location) at the top, a quiet «Будь-коли» zone (unconditional `none`) below, and «Минуло»
// (overdue) muted at the bottom. It does NOT decide membership: buildToday already chose which
// intents are in Today; this only GROUPS the existing `active`/`overdue` arrays. Empty sections
// render nothing (no orphan header). Card affordances are unchanged from the flat list.

import type { ReactNode } from "react";
import { IntentCard } from "@/components/IntentCard";
import { ActionButton } from "@/components/ActionButton";
import type { TodayView } from "@/lib/today";
import type { Intent } from "@/lib/types";
import { setIntentStatus, setTodayOverride } from "@/lib/store";
import { useIntentEditor } from "@/components/IntentEditorSheet";

// A moment-based intent has a condition that names a moment (a time or a place). `none` intents
// carry no moment — they belong to the quiet «Будь-коли» zone. This split is the only new logic
// here, and it partitions the EXISTING active array (nothing added, nothing dropped).
function isMomentBased(intent: Intent): boolean {
  return intent.condition.type !== "none";
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 px-1 text-[12px] font-semibold uppercase tracking-[0.13em] text-ink-3">
      <span>{title}</span>
      <span className="h-px flex-1 bg-line-soft" />
      <span className="tabular-nums text-ink-3/70">{count}</span>
    </h2>
  );
}

function Section({
  title,
  count,
  className,
  children,
}: {
  title: string;
  count: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={className}>
      <SectionHeader title={title} count={count} />
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// A single active («Готове до дії» / «Будь-коли») card — same affordances as the old flat list.
function ActiveCard({ intent, now }: { intent: Intent; now: Date }) {
  const { open } = useIntentEditor();
  // Recurring geo intent (Крок 2): can't be completed (no tick), resurfaces every time in the
  // city. Its ONLY terminal action is «відпустити», carried by the corner ✕.
  const recurring = intent.recurring && intent.condition.type === "location";
  return recurring ? (
    <IntentCard
      text={intent.text}
      priority={intent.priority}
      condition={intent.condition}
      now={now}
      state="today"
      recurring
      onEdit={() => open(intent)}
      onDismiss={() => setIntentStatus(intent.id, "released")}
      dismissLabel="Відпустити"
    />
  ) : (
    <IntentCard
      text={intent.text}
      priority={intent.priority}
      condition={intent.condition}
      now={now}
      state="today"
      onEdit={() => open(intent)}
      onComplete={() => setIntentStatus(intent.id, "done")}
      onDismiss={() => setTodayOverride(intent.id, "out")}
    />
  );
}

export function TodaySections({ view, now }: { view: TodayView; now: Date }) {
  const ready = view.active.filter(isMomentBased);
  const anytime = view.active.filter((i) => !isMomentBased(i));

  return (
    <div className="flex flex-col gap-8">
      {ready.length > 0 ? (
        <Section title="Готове до дії" count={ready.length}>
          {ready.map((intent) => (
            <ActiveCard key={intent.id} intent={intent} now={now} />
          ))}
        </Section>
      ) : null}

      {anytime.length > 0 ? (
        <Section title="Будь-коли" count={anytime.length}>
          {anytime.map((intent) => (
            <ActiveCard key={intent.id} intent={intent} now={now} />
          ))}
        </Section>
      ) : null}

      {view.overdue.length > 0 ? (
        <Section title="Прострочено" count={view.overdue.length}>
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
                  {/* Прострочене — живе-невиконане: виконати АБО відпустити, дві РІВНІ дії
                      без візуального тиску (обидві neutral). «Повернути в сьогодні» —
                      тихіша третя дія, не гучніша за вибір. */}
                  <ActionButton tone="neutral" onClick={() => setIntentStatus(intent.id, "done")}>
                    Виконано
                  </ActionButton>
                  <ActionButton
                    tone="neutral"
                    onClick={() => setIntentStatus(intent.id, "released")}
                  >
                    Відпустити
                  </ActionButton>
                  <ActionButton tone="accent" onClick={() => setTodayOverride(intent.id, "in")}>
                    Повернути в сьогодні
                  </ActionButton>
                </>
              }
            />
          ))}
        </Section>
      ) : null}
    </div>
  );
}
