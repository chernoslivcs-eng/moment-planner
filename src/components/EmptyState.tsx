import type { ReactNode } from "react";

export function EmptyState({
  emoji,
  glyph,
  title,
  hint,
  action,
}: {
  // Either an emoji (legacy) or a thin linear `glyph` from the product icon family. The prototype
  // uses a linear glyph (56px, ink-3, ~40% opacity) — prefer `glyph`; `emoji` is the fallback.
  emoji?: string;
  glyph?: ReactNode;
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      {glyph ? (
        <div className="mb-2 h-14 w-14 text-ink-3 opacity-40" aria-hidden>
          {glyph}
        </div>
      ) : (
        <div className="text-4xl opacity-70" aria-hidden>
          {emoji}
        </div>
      )}
      <h2 className="font-display text-xl font-medium leading-snug text-ink-2">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-ink-3">{hint}</p>
      {action}
    </div>
  );
}
