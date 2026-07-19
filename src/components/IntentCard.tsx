import type { ReactNode } from "react";
import type { Condition, Priority } from "@/lib/types";
import { describeCondition, priorityLabel } from "@/lib/format";

// Visual state of a card — the three-state language from the prototype.
//   today   — warm surface, soft shadow, clay accent bar (alive, ready to act)
//   waiting — transparent, thin border, hushed (asleep in the waiting field)
//   gone    — dashed border, dimmed, italic caption (released without reproach)
export type IntentCardState = "today" | "waiting" | "gone";

// Priority reads as a small dot / accent bar, never a loud badge.
const DOT: Record<Priority, string> = {
  high: "bg-clay",
  medium: "bg-amber",
  low: "bg-sage",
};

const BAR: Record<Priority, string> = {
  high: "bg-clay",
  medium: "bg-clay-soft",
  low: "bg-sage",
};

const CONTAINER: Record<IntentCardState, string> = {
  today: "border border-transparent bg-surface shadow-card",
  waiting: "border border-line-soft bg-transparent",
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

export function IntentCard({
  text,
  priority,
  condition,
  now,
  actions,
  state = "today",
}: {
  text: string;
  priority: Priority;
  condition: Condition;
  now?: Date;
  actions?: ReactNode;
  state?: IntentCardState;
}) {
  const isToday = state === "today";
  const isGone = state === "gone";

  return (
    <div className={`relative rounded-card p-4 transition ${CONTAINER[state]}`}>
      {/* today: clay accent bar, tinted by priority */}
      {isToday ? (
        <span
          className={`absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-full ${BAR[priority]}`}
          aria-hidden
        />
      ) : null}

      <div className="flex gap-3">
        {/* waiting / gone: priority dot */}
        {!isToday ? (
          <span
            className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${DOT[priority]} ${
              isGone ? "opacity-60" : ""
            }`}
            aria-hidden
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <p
            className={`text-[15px] leading-snug break-words ${
              isToday ? "font-medium text-ink" : "font-normal text-ink-2"
            }`}
          >
            {text}
          </p>
          {/* priority conveyed visually by dot/bar; kept for assistive tech */}
          <span className="sr-only">{priorityLabel(priority)}</span>

          {isGone ? (
            <span className="mt-2 block font-display text-[13px] italic text-ink-3">
              цей момент минув · {describeCondition(condition, now)}
            </span>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-clay/15 bg-clay/10 px-2.5 py-1 text-xs font-semibold text-ink-2">
                <span className="text-clay">
                  <ClockIcon />
                </span>
                {describeCondition(condition, now)}
              </span>
            </div>
          )}

          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
