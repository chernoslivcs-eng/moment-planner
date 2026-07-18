import type { ReactNode } from "react";

export function EmptyState({
  emoji,
  title,
  hint,
  action,
}: {
  emoji: string;
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-stone-500">{hint}</p>
      {action}
    </div>
  );
}
