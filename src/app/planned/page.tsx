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

// ── calendar lens (collapsible month grid, Monday-first) ───────────────────
// A quiet "lens over the list", NOT a second calendar. It reads the SAME day resolution
// (timeGroupDate) that already groups the «Час» section — no new date logic, no model
// fields. Days that carry a future time intent get a dot and become tappable; a tap filters
// the list below to that day. The title is a tap-handle: it toggles month ↔ two-weeks with a
// soft height morph + grid cross-fade. The trigger is a discrete TAP, not scroll, so the
// animation never fights a scrolling finger (jank-free on mobile).
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

// The current Monday-anchored week (7 cells) — the compact row shown in the sticky strip once
// the full month scrolls away. Same dayKey/out scheme as buildCells, so dots/selection line up.
function currentWeekCells(now: Date): Cell[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(year, month, now.getDate() - mondayOffset);
  const cells: Cell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cells.push({ blank: false, day: d.getDate(), key: dayKey(d), out: d.getMonth() !== month });
  }
  return cells;
}

// One grid cell — shared by every calendar surface (month grid, tap-compact, sticky week strip)
// so dot markers, selection (clay fill), today-highlight and out-of-month dimming stay identical
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

// Reads the ?collapse=scroll flag once on the client. Default (flag absent) keeps the proven
// tap-handle calendar; the flag opts into the experimental scroll-collapse lens so it can be
// tried on a real device via the preview URL without disturbing the safe default.
function useScrollCollapseFlag(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get("collapse") === "scroll");
  }, []);
  return on;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

  // The tap captures the "from" height on the OLD DOM, then flips mode; the layout effect
  // below measures the NEW height and morphs between the two. Ported from the prototype's
  // buildCalendar (measure → pin → reflow → transition height + cross-fade grid).
  function toggleMode() {
    if (bodyRef.current) fromHeightRef.current = bodyRef.current.offsetHeight;
    setMode((m) => (m === "month" ? "compact" : "month"));
  }

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
      {/* Тап-хендл згортання. Праворуч — помітний чип зі станом дії, щоб було ясно,
          що заголовок тапається (скрол-тригер свідомо не робимо — див. рішення A). */}
      <button
        type="button"
        onClick={toggleMode}
        aria-expanded={mode === "month"}
        aria-label={
          mode === "month" ? "Згорнути календар до двох тижнів" : "Розгорнути календар на місяць"
        }
        className="group mb-3 flex w-full items-center justify-between gap-2 px-0.5 font-display text-[15px] font-semibold tracking-wide text-ink-2"
      >
        <span>{title}</span>
        <span className="inline-flex flex-none items-center gap-1 rounded-full border border-clay/25 bg-clay/10 px-2.5 py-1 text-[12px] font-semibold text-clay transition group-active:scale-95">
          {mode === "month" ? "згорнути" : "розгорнути"}
          <ChevronIcon
            className={`h-3.5 w-3.5 transition-transform duration-300 ${
              mode === "month" ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

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

// ── sticky collapsing-header calendar (scroll-driven, flag: ?collapse=scroll) ─
// A TRUE native collapsing header, not a height morph. The full month grid sits in normal
// flow and scrolls away with the window — buttery, no reflow. A compact current-week strip is
// `position: sticky; top:0`, pinned over the list; it starts invisible and cross-fades IN as
// the month scrolls up. Space is reclaimed by SCROLLING PAST the tall month, never by shrinking
// an above-viewport element — that is what keeps iOS smooth (no scroll-anchor jump, since we
// never resize content above the viewport). The strip overlaps the month via a measured
// negative margin so there is no blank gap while it is invisible. Only opacity/pointer-events
// change at runtime (GPU-composited); the pin itself is pure CSS.
function StickyCalendarLens({
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
  const stripRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const [stripH, setStripH] = useState(0);
  const rafRef = useRef<number | null>(null);

  const todayKey = dayKey(now);
  const monthCells = buildCells("month", now);
  const weekCells = currentWeekCells(now);
  const monthTitle = calTitle("month", now);

  // Measure the strip before paint so the month's negative margin overlaps it exactly (no gap,
  // no one-frame jump). Re-measures if the day (hence layout) changes.
  useIsomorphicLayoutEffect(() => {
    if (stripRef.current) setStripH(stripRef.current.offsetHeight);
  }, [now]);

  // Passive, rAF-throttled scroll → crossfade. progress = how far the month has scrolled above
  // the pinned strip, normalised over the month's collapsible height. A smoothstep + dead-band
  // (hysteresis) keeps interactivity from flickering when a finger hovers near the midpoint.
  useEffect(() => {
    const strip = stripRef.current;
    const month = monthRef.current;
    if (!strip || !month) return;

    const apply = () => {
      rafRef.current = null;
      const sh = strip.offsetHeight || 1;
      const range = Math.max(month.offsetHeight - sh, 1);
      // month top relative to viewport: === strip top until the strip pins at 0, then goes
      // negative as the month scrolls up behind it.
      const monthTop = month.getBoundingClientRect().top;
      const raw = Math.min(Math.max(-monthTop / range, 0), 1);
      const p = raw * raw * (3 - 2 * raw); // smoothstep
      strip.style.opacity = String(p);
      month.style.opacity = String(1 - p);
      // hysteresis dead-band: don't hand pointer control over until clearly on one side.
      strip.style.pointerEvents = p > 0.6 ? "auto" : "none";
      month.style.pointerEvents = p < 0.4 ? "auto" : "none";
    };
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(apply);
    };

    apply(); // set the initial (scrolled-to-top) state
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [stripH]);

  return (
    <div className="mb-6 px-0.5">
      {/* Compact current-week strip — pinned at top, cross-fades in as the month scrolls away.
          -mx-5 px-5 lets its blurred paper background span full-bleed over the page gutter. */}
      <div
        ref={stripRef}
        className="sticky top-0 z-20 -mx-5 border-b border-line-soft bg-paper/95 px-5 pb-2 pt-3 backdrop-blur"
        style={{ opacity: 0, pointerEvents: "none" }}
      >
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <span className="font-display text-[13px] font-semibold tracking-wide text-ink-2">
            {monthTitle}
          </span>
          <span className="text-[11px] font-medium tracking-wide text-ink-3">цей тиждень</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekCells.map((c, i) => renderCell(c, i, todayKey, selectedKey, counts, onSelect))}
        </div>
      </div>

      {/* Full month — normal flow, scrolls away. Negative margin pulls it up to overlap the
          (initially invisible) strip so there is no blank band at rest. */}
      <div ref={monthRef} style={{ marginTop: stripH ? -stripH : 0 }}>
        <div className="mb-3 px-0.5 font-display text-[15px] font-semibold tracking-wide text-ink-2">
          {monthTitle}
        </div>
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="text-center text-[10px] font-semibold tracking-wide text-ink-3">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((c, i) => renderCell(c, i, todayKey, selectedKey, counts, onSelect))}
        </div>
      </div>
    </div>
  );
}

// ── soon card (a recognized non-time condition on a not-yet-enabled axis) ───
// Never produced by the current parser (location collapses to "none"), so this section stays
// hidden in practice — but it's built so it renders correctly once a non-time axis exists.
const DOT: Record<Priority, string> = { high: "bg-clay", medium: "bg-amber", low: "bg-sage" };

function SoonCard({ intent, now }: { intent: Intent; now: Date }) {
  return (
    <div className="relative rounded-card border border-line-soft bg-transparent p-4 opacity-80">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-normal leading-snug break-words text-ink-2">{intent.text}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {/* same unified priority language: dot in the meta row, before the chip */}
          <span className={`h-2 w-2 flex-none rounded-full ${DOT[intent.priority]}`} aria-hidden />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-transparent px-2.5 py-1 text-xs font-semibold text-ink-3">
            {describeCondition(intent.condition, now)}
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">· скоро</span>
          </span>
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollCollapse = useScrollCollapseFlag();
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
          {/* Календарна лінза — під осями, над списком. Тільки коли є датовані наміри.
              За замовчуванням — перевірений тап-хендл; ?collapse=scroll вмикає експериментальний
              collapsing-header по скролу (тап лишається як безпечний фолбек). */}
          {timeWaiting.length > 0 ? (
            scrollCollapse ? (
              <StickyCalendarLens
                now={now}
                counts={dayCounts}
                selectedKey={activeKey}
                onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
              />
            ) : (
              <CalendarLens
                now={now}
                counts={dayCounts}
                selectedKey={activeKey}
                onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
              />
            )
          ) : null}

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
