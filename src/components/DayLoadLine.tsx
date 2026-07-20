// Крок 5 · Ланка 2 — the quiet «реалістичність дня» line that sits under the date in «Сьогодні».
// PURELY PRESENTATIONAL: it renders one muted sentence («сьогодні намірів приблизно на N годин»)
// or nothing. No colour, no red, no warning icon — a calm statement, not a reproach. When the
// day has no measurable weight (empty / all-null) it renders nothing, so the row never hangs
// absurdly under the date.

import { formatDayLoad } from "@/lib/realism";

export function DayLoadLine({ minutes }: { minutes: number }) {
  const text = formatDayLoad(minutes);
  if (!text) return null;
  return <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{text}</p>;
}
