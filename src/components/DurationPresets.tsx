// Крок 5 · Ланка 3 — quiet duration presets for Розбір. NOT a numeric minutes field: the human
// nudges the model's estimate by tapping one of a few calm chips (—/15хв/30/1год/2+). This is
// presentation of the existing `duration` value, no new mechanics. Muted styling — it must not
// shout louder than the intent text it annotates.

const OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "—" },
  { value: 15, label: "15 хв" },
  { value: 30, label: "30 хв" },
  { value: 60, label: "1 год" },
  { value: 120, label: "2+" },
];

export function DurationPresets({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Приблизна тривалість">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition active:scale-95 ${
              active
                ? "border-clay/40 bg-clay/10 text-clay"
                : "border-line bg-transparent text-ink-3 hover:text-ink-2"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
