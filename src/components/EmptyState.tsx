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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="text-4xl opacity-70" aria-hidden>
        {emoji}
      </div>
      <h2 className="font-display text-xl font-medium leading-snug text-ink-2">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-ink-3">{hint}</p>
      {action}
    </div>
  );
}
