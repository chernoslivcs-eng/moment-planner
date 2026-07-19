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

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IntentCard } from "@/components/IntentCard";
import { EmptyState } from "@/components/EmptyState";
import { currentContext } from "@/lib/conditions/context";
import { buildToday } from "@/lib/today";
import { useIntents } from "@/lib/store";
import { useCurrentCity } from "@/lib/geo/currentCity";
import { addDays, dayStart, isSameLocalDay, nearestWeekday } from "@/lib/dates";
import type { Condition, Intent } from "@/lib/types";

// ── axis switcher (the row of pills) ────────────────────────────────────────
// The axes are mutually-exclusive FILTER TABS: tapping one shows a single slice of the waiting
// field by condition type. Three live axes now — «Час» (time), «Місце» (location/city, real
// geolocation), and «Інше» (unconditional intents + any not-yet-built condition type). The old
// locked «Погода»/«Курс»/«Повітря · скоро» chips are folded into the single «Інше» tab.
type Axis = "time" | "location" | "other";

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
// Map pin — the «Місце» axis marker; the SAME glyph the location condition chip uses on cards.
function PlaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0116 0z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
// «Інше» — a small dots glyph reading as "everything else / more".
function OtherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

const AXES: { key: Axis; label: string; icon: () => ReactNode }[] = [
  { key: "time", label: "Час", icon: ClockIcon },
  { key: "location", label: "Місце", icon: PlaceIcon },
  { key: "other", label: "Інше", icon: OtherIcon },
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

// ── calendar lens (collapsible month grid, Monday-first) ───────────────────
// A quiet "lens over the list", NOT a second calendar. It reads the SAME day resolution
// (timeGroupDate) that already groups the «Час» section — no new date logic, no model
// fields. Days that carry a future time intent get a dot and become tappable; a tap filters
// the list below to that day. Collapse is scroll-driven (prototype model): a scrollY threshold
// with hysteresis morphs month ↔ two-weeks in place (soft height morph + grid cross-fade). The
// morph is a one-shot animation fired by a debounced threshold, not coupled per-pixel to the
// finger, so it stays jank-free on mobile.
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] as const;

// Local calendar-day key (YYYY-MM-DD) from local Y/M/D — never toISOString (that is UTC and
// could cross a day boundary). Matches the local dayStart timeGroupDate already returns.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// day-key → how many future time intents fall on it (drives the dot markers).
function datedCounts(items: Intent[], now: Date): Map<string, number> {
  const counts = new Map<string, number>();
  for (const it of items) {
    const date = timeGroupDate(it.condition, now);
    if (!date) continue; // undated (daypart/unknown weekday) → not placeable on the grid
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

type Cell = { blank: true } | { blank: false; day: number; key: string; out: boolean };

type CalMode = "month" | "compact";

// Grid cells for a mode. month → leading blanks + every day of the month. compact → 14 days
// from Monday of the current week (days spilling into an adjacent month are flagged `out`,
// rendered dimmer). Same dayKey scheme as the dot map, so dots/selection line up in both modes.
function buildCells(mode: CalMode, now: Date): Cell[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (mode === "month") {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7; // week starts Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Cell[] = [];
    for (let i = 0; i < offset; i++) cells.push({ blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ blank: false, day: d, key: dayKey(new Date(year, month, d)), out: false });
    }
    return cells;
  }
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(year, month, now.getDate() - mondayOffset);
  const cells: Cell[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cells.push({ blank: false, day: d.getDate(), key: dayKey(d), out: d.getMonth() !== month });
  }
  return cells;
}

function calTitle(mode: CalMode, now: Date): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (mode === "month") {
    return cap(
      new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(
        new Date(year, month, 1),
      ),
    );
  }
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(year, month, now.getDate() - mondayOffset);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 13);
  const fmt = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" });
  return `${fmt.format(monday)} – ${fmt.format(end)} · два тижні`;
}

// useLayoutEffect on the client (measure before paint → no flash); inert no-op on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// One grid cell — shared by every calendar surface (month grid, compact two-weeks) so dot
// markers, selection (clay fill), today-highlight and out-of-month dimming stay identical
// no matter which lens renders it. A day with intents is a tappable filter; a bare day is inert.
function renderCell(
  c: Cell,
  i: number,
  todayKey: string,
  selectedKey: string | null,
  counts: Map<string, number>,
  onSelect: (key: string) => void,
) {
  if (c.blank) return <span key={`b${i}`} className="aspect-square" aria-hidden />;
  const isToday = c.key === todayKey;
  const isSelected = c.key === selectedKey;

  if (counts.has(c.key)) {
    return (
      <button
        key={c.key}
        type="button"
        aria-pressed={isSelected}
        aria-label={`${c.day} — є наміри`}
        onClick={() => onSelect(c.key)}
        className={`relative flex aspect-square items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.94] ${
          isSelected
            ? "bg-clay text-white"
            : isToday
              ? "bg-surface text-ink shadow-card"
              : c.out
                ? "text-ink-2"
                : "text-ink"
        }`}
      >
        {c.day}
        <span
          className={`absolute bottom-1.5 left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full ${
            isSelected ? "bg-white" : "bg-clay"
          }`}
          aria-hidden
        />
      </button>
    );
  }

  // Plain day: no intents → not interactive (matches «тап без намірів → нічого»).
  return (
    <span
      key={c.key}
      className={`flex aspect-square items-center justify-center rounded-xl text-sm ${
        isToday
          ? "bg-surface font-bold text-ink shadow-card"
          : c.out
            ? "font-medium text-ink-3/60"
            : "font-medium text-ink-3/90"
      }`}
    >
      {c.day}
    </span>
  );
}

function CalendarLens({
  now,
  counts,
  selectedKey,
  onSelect,
}: {
  now: Date;
  counts: Map<string, number>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [mode, setMode] = useState<CalMode>("month");
  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fromHeightRef = useRef<number | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayKey = dayKey(now);
  const cells = buildCells(mode, now);
  const title = calTitle(mode, now);

  // Capture the "from" height on the OLD DOM, then flip mode; the layout effect below measures
  // the NEW height and morphs between the two. Ported from the prototype's buildCalendar
  // (measure → pin → reflow → transition height + cross-fade grid).
  function morphTo(next: CalMode) {
    if (next === mode) return;
    if (bodyRef.current) fromHeightRef.current = bodyRef.current.offsetHeight;
    setMode(next);
  }

  // Scroll drives the collapse (prototype parity, lines 1084–1088): window scrollY with hysteresis
  // — collapse to compact past 90px, re-expand to month above 30px. The 60px dead-band stops
  // flicker at the boundary. It fires the height-morph, so space is reclaimed by the calendar
  // shrinking in place (a one-shot 0.36s animation), NOT by scrolling a tall month out of view —
  // which is why it works no matter how short the list is. rAF-throttled, passive.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const st = window.scrollY;
        if (mode === "month" && st > 90) morphTo("compact");
        else if (mode === "compact" && st < 30) morphTo("month");
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useIsomorphicLayoutEffect(() => {
    const el = bodyRef.current;
    const from = fromHeightRef.current;
    if (!el || from == null) return; // first mount: nothing to morph from → static
    fromHeightRef.current = null;

    const to = el.offsetHeight;
    if (to === from) return;

    const grid = gridRef.current;
    el.style.height = `${from}px`;
    el.style.overflow = "hidden";
    if (grid) grid.style.opacity = "0";
    void el.offsetHeight; // force reflow so the browser registers the start height
    el.style.transition = "height 0.36s cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.height = `${to}px`;
    if (grid) {
      grid.style.transition = "opacity 0.32s ease 0.06s";
      requestAnimationFrame(() => {
        grid.style.opacity = "1";
      });
    }
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      if (grid) {
        grid.style.opacity = "";
        grid.style.transition = "";
      }
    }, 400);
  }, [mode]);

  useEffect(
    () => () => {
      if (animTimer.current) clearTimeout(animTimer.current);
    },
    [],
  );

  return (
    <div className="mb-6 px-0.5">
      {/* Scroll-driven (prototype): the title is a plain label, dimmed while collapsed
          (.cal-collapsed .cal-title{opacity:.75}). Scroll — not a tap — drives the morph. */}
      <div
        className={`mb-3 px-0.5 font-display text-[15px] font-semibold tracking-wide text-ink-2 transition-opacity duration-300 ${
          mode === "compact" ? "opacity-75" : ""
        }`}
      >
        {title}
      </div>

      <div ref={bodyRef}>
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="text-center text-[10px] font-semibold tracking-wide text-ink-3">
              {w}
            </span>
          ))}
        </div>
        <div ref={gridRef} className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => renderCell(c, i, todayKey, selectedKey, counts, onSelect))}
        </div>
      </div>
    </div>
  );
}

export default function PlannedPage() {
  const intents = useIntents();
  const [waiting, setWaiting] = useState<Intent[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // The active filter tab. Mutually exclusive: the screen shows exactly one axis' slice.
  const [axis, setAxis] = useState<Axis>("time");
  // Same current-city source as «Сьогодні», so a city intent that surfaced there is correctly
  // excluded from the waiting field here (and reappears when you leave that city).
  const city = useCurrentCity();
  const now = new Date();

  // Re-derive on the same triggers as «Сьогодні» so the split stays consistent (and on city).
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      buildToday(intents, currentContext(city)).then((view) => {
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
  }, [intents, city]);

  // The three axis slices — one intent belongs to exactly one axis (its condition type), never
  // duplicated across tabs. «Час» and «Місце» read the waiting field (intents not surfaced today).
  // «Інше» reads the FULL open set: unconditional ("none") intents always hold today, so they're
  // never in `waiting` — sourcing them here (and from any future not-yet-built condition type) is
  // the only way they show on this axis. Consequence: a "none" intent appears on both «Сьогодні»
  // and «Заплановано»/«Інше» — intended, since «Інше» is the home for conditionless intents.
  const timeWaiting = waiting.filter((i) => i.condition.type === "time");
  const locationWaiting = waiting.filter((i) => i.condition.type === "location");
  const otherIntents = intents.filter(
    (i) =>
      i.status === "open" && i.condition.type !== "time" && i.condition.type !== "location",
  );
  const dayGroups = groupByDay(timeWaiting, now);
  const isEmpty =
    timeWaiting.length === 0 && locationWaiting.length === 0 && otherIntents.length === 0;

  // Calendar lens: dot map + a resilient selection (drop a stale day if its dot vanished
  // after a re-derive, so the filter can't strand the user on an empty day).
  const dayCounts = datedCounts(timeWaiting, now);
  const activeKey = selectedKey && dayCounts.has(selectedKey) ? selectedKey : null;
  const selectedItems = activeKey
    ? timeWaiting.filter((i) => {
        const d = timeGroupDate(i.condition, now);
        return d ? dayKey(d) === activeKey : false;
      })
    : [];

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

      {/* Axis filter tabs — mutually exclusive; the active one is filled, others are outlines. */}
      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AXES.map(({ key, label, icon: Icon }) => {
          const active = axis === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setAxis(key)}
              className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-transparent text-ink-3"
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </div>

      {isEmpty ? (
        <EmptyState
          emoji="🗓️"
          title="Тут тихо чекають наміри"
          hint="Запиши перший — і він приляже тут до свого часу. Це поле, а не список справ: воно не докоряє."
        />
      ) : axis === "time" ? (
        timeWaiting.length === 0 ? (
          <AxisEmpty>Жоден намір поки не чекає на конкретний час.</AxisEmpty>
        ) : (
          <>
            {/* Календарна лінза — під осями, над списком. Тільки коли є датовані наміри.
                Згортається за скролом (модель прототипу: морф за порогом з гістерезисом). */}
            <CalendarLens
              now={now}
              counts={dayCounts}
              selectedKey={activeKey}
              onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
            />

            {activeKey ? (
              /* Обрано день у календарі — список звужено до цієї дати. */
              <section>
                <div className="mb-4 flex items-center gap-2.5 px-1 font-display text-sm font-semibold text-ink-2">
                  <span>Обрано {dayLabel(keyToDate(activeKey), now)}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    className="text-[12px] font-semibold text-clay underline underline-offset-2"
                  >
                    показати все
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {selectedItems.map((intent) => (
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
              </section>
            ) : (
              <section>
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
            )}
          </>
        )
      ) : axis === "location" ? (
        /* Вісь «Місце» — наміри, чий час настане в певному місті (жива геолокація). Виринають
           у «Сьогодні», коли ти там; тут тихо чекають, поки ти деінде. */
        locationWaiting.length === 0 ? (
          <AxisEmpty>Немає намірів, прив&apos;язаних до місця. Скажи «у Львові…» — і він приляже сюди.</AxisEmpty>
        ) : (
          <section className="flex flex-col gap-3">
            {locationWaiting.map((intent) => (
              <IntentCard
                key={intent.id}
                text={intent.text}
                priority={intent.priority}
                condition={intent.condition}
                now={now}
                state="waiting"
              />
            ))}
          </section>
        )
      ) : (
        /* Вісь «Інше» — безумовні наміри (та будь-який ще-не-ввімкнений тип умови). */
        otherIntents.length === 0 ? (
          <AxisEmpty>Тут зберуться наміри без умови — ті, що можна зробити будь-коли.</AxisEmpty>
        ) : (
          <section className="flex flex-col gap-3">
            {otherIntents.map((intent) => (
              <IntentCard
                key={intent.id}
                text={intent.text}
                priority={intent.priority}
                condition={intent.condition}
                now={now}
                state="waiting"
              />
            ))}
          </section>
        )
      )}
    </main>
  );
}

// A gentle per-axis empty line — the axis has no intents yet, but the field is not empty overall.
function AxisEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 pt-2 font-display text-[15px] italic leading-relaxed text-ink-3">
      {children}
    </p>
  );
}
