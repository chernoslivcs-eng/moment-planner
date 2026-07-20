import type { ReactNode } from "react";
import type { Condition, Priority } from "@/lib/types";
import { describeCondition, priorityLabel } from "@/lib/format";

// Visual state of a card — the three-state language from the prototype.
// State encodes WEIGHT only (not priority):
//   today   — warm surface, soft shadow (alive, surfaced)
//   waiting — IDENTICAL to today by deliberate design decision: a waiting intent is a full,
//             present card (warm surface + shadow + full-weight text), not a hushed one
//   gone    — dashed border, dimmed, italic caption (released without reproach)
export type IntentCardState = "today" | "waiting" | "gone";

// Priority reads as one small colour dot — the SAME language in every card, sitting in the
// meta row just before the condition chip (never a leading mark, never a left edge bar).
const DOT: Record<Priority, string> = {
  high: "bg-clay",
  medium: "bg-amber",
  low: "bg-sage",
};

const CONTAINER: Record<IntentCardState, string> = {
  today: "border border-line-soft bg-surface shadow-card",
  // waiting is deliberately IDENTICAL to today — a surfaced, present card, not a hushed one.
  waiting: "border border-line-soft bg-surface shadow-card",
  gone: "border border-dashed border-line bg-transparent opacity-60",
};

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

// Timeless ("none") intents get a NON-clock mark — a downward arrow, per the prototype —
// so the chip never implies a moment the intent doesn't have. Clock stays time-only.
function AnytimeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Location ("city") intents get a map PIN — the SAME marker as the «Місце» axis on «Заплановано»
// (identical path), so a place condition reads as a place, never as an anytime arrow.
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0116 0z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

// Which mark the condition chip shows: three distinct marks — clock = time, pin = place,
// arrow = anytime (unconditional). One icon per condition type, never mixed.
function ConditionIcon({ condition }: { condition: Condition }) {
  if (condition.type === "time") return <ClockIcon />;
  if (condition.type === "location") return <PinIcon />;
  return <AnytimeIcon />;
}

// The «Сьогодні» active-card affordances (prototype todayCard): a large tap-target
// tick on the LEFT (mark done) and a small corner X on the TOP-RIGHT (drop from today).
// Both are opt-in — rendered only when the matching callback is passed — so the shared
// card stays a plain card everywhere else (Заплановано list, Розбір sheet, empty-state).
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

// Recurrence mark (prototype `I.repeat`) — a recurring intent shows this in place of the done
// tick: it deliberately CANNOT be checked off. The circle mirrors the tick's footprint so the
// card keeps its rhythm; the mark itself is non-interactive (a status, not a button).
function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden>
      <path
        d="M17 2l4 4-4 4M21 6H8a4 4 0 00-4 4v1M7 22l-4-4 4-4M3 18h13a4 4 0 004-4v-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IntentCard({
  text,
  priority,
  condition,
  now,
  actions,
  state = "today",
  onComplete,
  onDismiss,
  onEdit,
  dismissLabel = "Прибрати з сьогодні",
  done = false,
  recurring = false,
}: {
  text: string;
  priority: Priority;
  condition: Condition;
  now?: Date;
  actions?: ReactNode;
  state?: IntentCardState;
  onComplete?: () => void;
  onDismiss?: () => void;
  // Крок 6 · Ланка 2 — tapping the intent TEXT opens the single editor. Opt-in (only saved
  // cards on «Сьогодні»/«Заплановано» pass it); the tick and corner ✕ stay separate zones and
  // never open the editor. Without it the text is plain, non-interactive copy (розбір/empty).
  onEdit?: () => void;
  // Accessible label / tooltip for the corner ✕. Defaults to the «Сьогодні» meaning
  // (drop from today); the Розбір gate overrides it (remove from the current review).
  dismissLabel?: string;
  done?: boolean;
  // A recurring geo intent (Крок 2): shows the repeat mark instead of the done tick (it can't
  // be completed), and its condition chip reads «щоразу у Львові». The caller only sets this
  // for location + recurring; time/unconditional intents ignore it.
  recurring?: boolean;
}) {
  const isGone = state === "gone";

  return (
    <div
      className={`relative rounded-card p-4 transition ${CONTAINER[state]} ${
        done ? "opacity-55" : ""
      }`}
    >
      {/* corner X — drop from today (opt-in) */}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel.toLowerCase()}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-line-soft bg-paper text-ink-3 transition active:scale-[0.88]"
        >
          <CloseIcon />
        </button>
      ) : null}

      <div className="flex gap-3">
        {/* gone keeps a leading dot beside its italic caption (it has no meta chip);
            today & waiting instead carry priority in the meta row, below. */}
        {isGone ? (
          <span
            className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full opacity-60 ${DOT[priority]}`}
            aria-hidden
          />
        ) : null}

        {/* recurring geo → non-interactive repeat mark; it deliberately can't be checked off */}
        {recurring && !isGone ? (
          <span
            role="img"
            aria-label="Повторюється"
            title="повторюється — не закривається, виринає щоразу"
            className="mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.8px] border-line text-ink-3"
          >
            <RepeatIcon />
          </span>
        ) : onComplete ? (
          /* tick — mark done (opt-in): fills clay when done, empty circle otherwise */
          <button
            type="button"
            onClick={onComplete}
            aria-label="Виконано"
            className={`mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.8px] transition active:scale-90 ${
              done ? "border-clay bg-clay text-white" : "border-line text-transparent"
            }`}
          >
            <CheckIcon />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          {onEdit && !isGone ? (
            // Text is the tap-target that opens the editor. A left-aligned, full-width button so
            // the whole line is tappable; the tick and corner ✕ live outside it, untouched.
            <button
              type="button"
              onClick={onEdit}
              className={`block w-full text-left text-[15px] font-medium leading-snug text-ink break-words transition active:opacity-70 ${
                done ? "text-ink-3 line-through" : ""
              } ${onDismiss ? "pr-8" : ""}`}
            >
              {text}
            </button>
          ) : (
            <p
              className={`text-[15px] leading-snug break-words ${
                isGone ? "font-normal text-ink-2" : "font-medium text-ink"
              } ${done ? "text-ink-3 line-through" : ""} ${onDismiss ? "pr-8" : ""}`}
            >
              {text}
            </p>
          )}
          {/* priority conveyed visually by the meta-row dot; kept for assistive tech */}
          <span className="sr-only">{priorityLabel(priority)}</span>

          {isGone ? (
            <span className="mt-2 block font-display text-[13px] italic text-ink-3">
              цей момент минув · {describeCondition(condition, now)}
            </span>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {/* unified priority language: one colour dot, immediately before the chip */}
              <span className={`h-2 w-2 flex-none rounded-full ${DOT[priority]}`} aria-hidden />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-clay/15 bg-clay/10 px-2.5 py-1 text-xs font-semibold text-ink-2">
                <span className="text-clay">
                  <ConditionIcon condition={condition} />
                </span>
                {describeCondition(condition, now, { recurring })}
              </span>
            </div>
          )}

          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
