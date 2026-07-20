"use client";

// Крок 6 · Ланка 2 — Єдиний редактор наміру. ОДИН компонент на всі контексти (розбір-кандидат
// і збережений намір): текст, пріоритет, умова (час/місце/без умови), recurring (лише для місця,
// Крок 2), duration (тихі пресети, Крок 5). Тримає робочу копію в стані; коміт лише на «Готово»
// (onSave з повним набором правок). «Скасувати» — onCancel без збереження. Умова жива: пресети
// сьогодні/завтра/обрати день/без умови/місце будують коректну Condition на льоту. Локатив
// «у Львові» — на льоту з номінатива (зберігаємо номінатив). recurring-перемикач видно ТІЛЬКИ
// коли умова = місце (час/без-умови — часова рекурентність поза MVP).

import { useState } from "react";
import type { Condition, Intent, IntentEdit, Priority } from "@/lib/types";
import { addDays, isSameLocalDay } from "@/lib/dates";
import { DurationPresets } from "@/components/DurationPresets";

type EditableIntent = Pick<Intent, "text" | "priority" | "condition" | "recurring" | "duration">;

// UI key for the condition row — a flat choice the human taps, mapped to a real Condition on save.
type CondKey = "today" | "tomorrow" | "custom" | "none" | "location";

const PRIO_PILLS: { value: Priority; label: string; dot: string }[] = [
  { value: "high", label: "важливо", dot: "bg-clay" },
  { value: "medium", label: "звичайне", dot: "bg-amber" },
  { value: "low", label: "колись", dot: "bg-sage" },
];

// Naive local-date ISO (no offset), matching how the parser stores `at` — the wall-clock day the
// user means, never shifted by timezone. Time defaults to midnight (a whole-day condition).
function localDateISO(d: Date, time = "00:00"): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}T${time}:00`;
}

// Derive the initial UI key from an existing condition.
function initialKey(condition: Condition, now: Date): CondKey {
  if (condition.type === "none") return "none";
  if (condition.type === "location") return "location";
  const at = condition.value.at;
  if (!at) return "custom";
  const day = new Date(at);
  if (isSameLocalDay(day, now)) return "today";
  if (isSameLocalDay(day, addDays(now, 1))) return "tomorrow";
  return "custom";
}

export function IntentEditor({
  intent,
  now = new Date(),
  onSave,
  onCancel,
}: {
  intent: EditableIntent;
  now?: Date;
  onSave: (edit: IntentEdit) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(intent.text);
  const [priority, setPriority] = useState<Priority>(intent.priority);
  const [condKey, setCondKey] = useState<CondKey>(initialKey(intent.condition, now));
  const [city, setCity] = useState(
    intent.condition.type === "location" ? intent.condition.value.city : "",
  );
  const timeAt = intent.condition.type === "time" ? intent.condition.value.at : null;
  const [customDate, setCustomDate] = useState(timeAt ? timeAt.slice(0, 10) : "");
  const [customTime, setCustomTime] = useState(
    timeAt && timeAt.slice(11, 16) !== "00:00" ? timeAt.slice(11, 16) : "",
  );
  const [recurring, setRecurring] = useState(intent.recurring);
  const [duration, setDuration] = useState<number | null>(intent.duration);
  // Whether the human touched any condition control. Until they do, the stored condition is left
  // untouched (the patch omits `condition`/`recurring`) — so a `daypart`/`weekday` intent the
  // editor can't represent is never silently rewritten to a concrete date on a no-op save.
  const [condTouched, setCondTouched] = useState(false);

  const isLocation = condKey === "location";

  function buildCondition(): Condition {
    switch (condKey) {
      case "none":
        return { type: "none" };
      case "location":
        return { type: "location", value: { city: city.trim() } };
      case "today":
        return { type: "time", value: { kind: "date", at: localDateISO(now), weekday: null, daypart: null } };
      case "tomorrow":
        return {
          type: "time",
          value: { kind: "date", at: localDateISO(addDays(now, 1)), weekday: null, daypart: null },
        };
      case "custom": {
        const day = customDate ? new Date(`${customDate}T00:00:00`) : now;
        const at = customTime ? localDateISO(day, customTime) : localDateISO(day);
        return {
          type: "time",
          value: { kind: customTime ? "datetime" : "date", at, weekday: null, daypart: null },
        };
      }
    }
  }

  function handleSave() {
    onSave({
      text: text.trim(),
      priority,
      // Only rewrite the condition when the human actually touched a condition control. Leaving
      // it out keeps `daypart`/`weekday` (which the editor cannot represent) intact — «відкрив і
      // зберіг, не чіпаючи умову» must not degrade it to a concrete date. When touched, recurrence
      // rides along: meaningful only for a place (Крок 2), forced false for time/unconditional.
      ...(condTouched
        ? { condition: buildCondition(), recurring: isLocation ? recurring : false }
        : {}),
      duration,
    });
  }

  const condPill = (key: CondKey, label: string) => (
    <button
      type="button"
      onClick={() => {
        setCondKey(key);
        setCondTouched(true);
      }}
      aria-pressed={condKey === key}
      className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-[0.97] ${
        condKey === key
          ? "border-clay bg-clay/10 text-ink"
          : "border-line bg-surface text-ink-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h2 className="mt-1 font-display text-[23px] font-semibold text-ink">Виправити намір</h2>
      <p className="mt-1 mb-4 text-[13.5px] leading-relaxed text-ink-2">
        Один намір — одне вікно. Поправ те, що я недочув.
      </p>

      {/* Текст */}
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3/70">
          Текст
        </div>
        <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
          <input
            aria-label="Текст наміру"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            className="w-full bg-transparent font-display text-[17px] text-ink outline-none"
          />
        </div>
      </div>

      {/* Пріоритет */}
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3/70">
          Пріоритет
        </div>
        <div className="flex flex-wrap gap-2">
          {PRIO_PILLS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              aria-pressed={priority === p.value}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                priority === p.value
                  ? "border-clay bg-clay/10 text-ink"
                  : "border-line bg-surface text-ink-2"
              }`}
            >
              <span className={`h-2 w-2 flex-none rounded-full ${p.dot}`} aria-hidden />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Умова */}
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3/70">
          Умова
        </div>
        <div className="flex flex-wrap gap-2">
          {condPill("today", "сьогодні")}
          {condPill("tomorrow", "завтра")}
          {condPill("custom", "обрати день")}
          {condPill("none", "без умови")}
          {condPill("location", "місце")}
        </div>

        {condKey === "custom" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Дата"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setCondTouched(true);
              }}
              className="rounded-soft border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
            />
            <input
              type="time"
              aria-label="Час"
              value={customTime}
              onChange={(e) => {
                setCustomTime(e.target.value);
                setCondTouched(true);
              }}
              className="rounded-soft border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
            />
            <span className="text-xs text-ink-3">необовʼязково — можна лише день</span>
          </div>
        ) : null}

        {isLocation ? (
          <div className="mt-3 space-y-3">
            <input
              aria-label="Місто"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setCondTouched(true);
              }}
              placeholder="напр. Львів"
              autoComplete="off"
              className="w-full rounded-soft border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
            {/* recurring — ЛИШЕ для місця (Крок 2): намір, що виринає щоразу в цьому місті */}
            <button
              type="button"
              role="switch"
              aria-checked={recurring}
              aria-label="Повторювати щоразу"
              onClick={() => {
                setRecurring((r) => !r);
                setCondTouched(true);
              }}
              className="flex w-full items-center justify-between rounded-soft border border-line bg-surface px-3.5 py-2.5 text-left"
            >
              <span className="text-[14px] font-medium text-ink-2">Повторювати щоразу в цьому місті</span>
              <span
                className={`relative h-6 w-10 flex-none rounded-full transition ${
                  recurring ? "bg-clay" : "bg-line"
                }`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    recurring ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Тривалість (тихі пресети, Крок 5) */}
      <div className="mb-5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3/70">
          Скільки часу
        </div>
        <DurationPresets value={duration} onChange={setDuration} />
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-card border border-line px-5 py-3.5 text-[15px] font-semibold text-ink-2 transition active:scale-[0.98]"
        >
          Скасувати
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-card bg-clay px-4 py-3.5 text-[15px] font-semibold text-white shadow-lift transition active:scale-[0.98]"
        >
          Готово
        </button>
      </div>
    </div>
  );
}
