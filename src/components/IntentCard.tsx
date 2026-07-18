import type { ReactNode } from "react";
import type { Condition, Priority } from "@/lib/types";
import { describeCondition, priorityLabel } from "@/lib/format";

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-stone-200 text-stone-600",
};

export function IntentCard({
  text,
  priority,
  condition,
  muted = false,
  now,
  actions,
}: {
  text: string;
  priority: Priority;
  condition: Condition;
  muted?: boolean;
  now?: Date;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition ${
        muted ? "opacity-60" : ""
      }`}
    >
      <p className="text-[15px] leading-snug text-stone-900">{text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLE[priority]}`}
        >
          {priorityLabel(priority)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
          <span aria-hidden>🕑</span>
          {describeCondition(condition, now)}
        </span>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
