"use client";

// Step 3A — structure of the «Заплановано» screen (NO calendar grid; that's 3B).
//
// «Заплановано» is a purely TIME screen now: it shows future-dated time intents — the ones
// today's plan is NOT surfacing (neither active nor overdue). Unconditional ("none") intents
// live in «Сьогодні» (they always hold today), so they never appear here; time intents dated
// today or in the past are surfaced/overdue in «Сьогодні» too. What remains — open time
// intents that buildToday leaves untouched — are exactly the future ones.
//
// Read-only: reuses buildToday to know what today already claims, then arranges the rest.
// Touches no lib/store/parse/today logic — display-only, grouping done from exported helpers.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IntentCard } from "@/components/IntentCard";
import { EmptyState } from "@/components/EmptyState";
import { currentContext } from "@/lib/conditions/context";
import { buildToday } from "@/lib/today";
import { useIntents } from "@/lib/store";
import { describeCondition } from "@/lib/format";
import { addDays, dayStart, isSameLocalDay, nearestWeekday } from "@/lib/dates";
import type { Condition, Intent, Priority } from "@/lib/types";

// ── axis switcher (the row of pills) ────────────────────────────────────────
// Only «Час» is a real axis in this phase. The rest are locked previews — tapping one shows
// a toast and does nothing else (zero logic behind a locked axis, per the spec).
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function PlaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0116 0z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function WeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M17 18a4 4 0 000-8 6 6 0 00-11.3 2A3.5 3.5 0 006 18z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function RateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LOCKED_AXES: { label: string; icon: () => ReactNode; toast: string }[] = [
  { label: "Місце", icon: PlaceIcon, toast: "Місце — вмикаємо у Фазі 4" },
  { label: "Погода", icon: WeatherIcon, toast: "Погода — вмикаємо у Фазі 4" },
  { label: "Курс", icon: RateIcon, toast: "Курс валют — вмикаємо у Фазі 4" },
];

// ── day resolution / labels (display-only, from exported date primitives) ───
function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// The concrete day a time intent belongs to — for grouping and sorting.
function timeGroupDate(condition: Condition, now: Date): Date | null {
  if (condition.type !== "time") return null;
  const v = condition.value;
  if (v.at) {
    const d = new Date(v.at);
    return Number.isNaN(d.getTime()) ? null : dayStart(d);
  }
  if (v.kind === "weekday") return nearestWeekday(v.weekday, now);
  return null; // daypart-only never reaches here (it holds today → lives in «Сьогодні»)
}

// Header for a day group: «Завтра», a weekday name within the week, else an explicit date.
function dayLabel(date: Date, now: Date): string {
  if (isSameLocalDay(date, addDays(now, 1))) return "Завтра";
  const diff = Math.round((dayStart(date).getTime() - dayStart(now).getTime()) / 86_400_000);
  if (diff >= 2 && diff <= 6) {
    return cap(new Intl.DateTimeFormat("uk-UA", { weekday: "long" }).format(date));
  }
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(date);
}

type DayGroup = { key: string; label: string; date: Date; items: Intent[] };

// Group future time intents by their day, groups ascending in time.
function groupByDay(items: Intent[], now: Date): DayGroup[] {
  const buckets = new Map<string, DayGroup>();
  const undated: Intent[] = [];
  for (const it of items) {
    const date = timeGroupDate(it.condition, now);
    if (!date) {
      undated.push(it);
      continue;
    }
    const key = date.toISOString();
    const group = buckets.get(key);
    if (group) group.items.push(it);
    else buckets.set(key, { key, label: dayLabel(date, now), date, items: [it] });
  }
  const groups = [...buckets.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (undated.length > 0) {
    groups.push({ key: "later", label: "Найближчим часом", date: new Date(8.64e15), items: undated });
  }
  return groups;
}

// ── soon card (a recognized non-time condition on a not-yet-enabled axis) ───
// Never produced by the current parser (location collapses to "none"), so this section stays
// hidden in practice — but it's built so it renders correctly once a non-time axis exists.
const DOT: Record<Priority, string> = { high: "bg-clay", medium: "bg-amber", low: "bg-sage" };

function SoonCard({ intent, now }: { intent: Intent; now: Date }) {
  return (
    <div className="relative rounded-card border border-line-soft bg-transparent p-4 opacity-80">
      <div className="flex gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full opacity-60 ${DOT[intent.priority]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-normal leading-snug break-words text-ink-2">{intent.text}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-transparent px-2.5 py-1 text-xs font-semibold text-ink-3">
              {describeCondition(intent.condition, now)}
              <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">· скоро</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── section label helper (matches «Сьогодні»'s divider style) ───────────────
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 px-1 text-[12px] font-semibold uppercase tracking-[0.13em] text-ink-3">
      <span>{children}</span>
      <span className="h-px flex-1 bg-line-soft" />
    </h2>
  );
}

export default function PlannedPage() {
  const intents = useIntents();
  const [waiting, setWaiting] = useState<Intent[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = new Date();

  // Re-derive on the same triggers as «Сьогодні» so the split stays consistent.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      buildToday(intents, currentContext()).then((view) => {
        if (cancelled) return;
        const surfaced = new Set([...view.active, ...view.overdue].map((i) => i.id));
        setWaiting(intents.filter((i) => i.status === "open" && !surfaced.has(i.id)));
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

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2100);
  }

  // Future time intents (grouped by day) and the reserved non-time bucket.
  const timeWaiting = waiting.filter((i) => i.condition.type === "time");
  const otherWaiting = waiting.filter((i) => i.condition.type !== "time");
  const dayGroups = groupByDay(timeWaiting, now);
  const isEmpty = timeWaiting.length === 0 && otherWaiting.length === 0;

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      <header className="mb-5 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          Поле очікування
        </p>
        <h1 className="mt-2 font-display text-[33px] font-semibold leading-[1.05] tracking-tight text-ink">
          Заплановано
        </h1>
        <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-ink-2">
          те, що тихо чекає свого моменту
        </p>
      </header>

      {/* Axis switcher — «Час» active, the rest locked previews. */}
      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-ink bg-ink px-3.5 py-2 text-[13px] font-semibold text-white">
          <ClockIcon />
          Час
        </span>
        {LOCKED_AXES.map((axis) => (
          <button
            key={axis.label}
            type="button"
            onClick={() => showToast(axis.toast)}
            className="inline-flex flex-none items-center gap-1.5 rounded-full border border-line bg-transparent px-3.5 py-2 text-[13px] font-semibold text-ink-3 opacity-70"
          >
            <axis.icon />
            {axis.label}
            <span className="ml-0.5 text-[10px] tracking-wide opacity-80">· скоро</span>
          </button>
        ))}
      </div>

      {isEmpty ? (
        <EmptyState
          emoji="🗓️"
          title="Тут тихо чекають наміри"
          hint="Запиши перший — і він приляже тут до свого часу. Це поле, а не список справ: воно не докоряє."
        />
      ) : (
        <>
          {/* Секція «Час» — future time intents grouped by day. */}
          {timeWaiting.length > 0 ? (
            <section>
              <SectionLabel>Час</SectionLabel>
              {dayGroups.map((group) => (
                <div key={group.key} className="mb-5">
                  <p className="mb-2.5 px-1 font-display text-sm font-semibold tracking-wide text-ink-2">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-3">
                    {group.items.map((intent) => (
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
                </div>
              ))}
            </section>
          ) : null}

          {/* Секція «Інші умови · скоро» — recognized non-time conditions, axis not yet on. */}
          {otherWaiting.length > 0 ? (
            <section className="mt-4">
              <SectionLabel>Інші умови · скоро</SectionLabel>
              <p className="mb-3 px-1 font-display text-[13px] italic leading-relaxed text-ink-3">
                Продукт уже почув ці умови. Виринуть, коли ми ввімкнемо відповідну вісь.
              </p>
              <div className="flex flex-col gap-3">
                {otherWaiting.map((intent) => (
                  <SoonCard key={intent.id} intent={intent} now={now} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* Transient toast for locked axes. */}
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-30 flex justify-center px-6">
          <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper shadow-card">
            {toast}
          </span>
        </div>
      ) : null}
    </main>
  );
}
