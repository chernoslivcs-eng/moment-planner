import type { ReactNode } from "react";

export function ActionButton({
  onClick,
  children,
  tone = "neutral",
  active = false,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "danger" | "accent";
  active?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97]";
  const styles =
    tone === "danger"
      ? "border-line-soft bg-transparent text-ink-3 hover:bg-surface"
      : tone === "accent"
        ? active
          ? "border-clay bg-clay text-white"
          : "border-line bg-transparent text-ink-2 hover:bg-surface"
        : "border-line bg-transparent text-ink-2 hover:bg-surface";
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
