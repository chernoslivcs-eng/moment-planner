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
  const base = "rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-[0.98]";
  const styles =
    tone === "danger"
      ? "bg-stone-100 text-stone-500 hover:bg-stone-200"
      : tone === "accent"
        ? active
          ? "bg-amber-500 text-white"
          : "bg-stone-100 text-stone-700 hover:bg-stone-200"
        : "bg-stone-100 text-stone-700 hover:bg-stone-200";
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
