"use client";

// First-run onboarding overlay, ported from the approved reference (moment-planner-onboarding).
// Two phases: an animated intro, then a 4-slide deck. It sits OVER the real app (z-100) and, on
// finish/skip, hands control back via `onDone` — the provider is what persists the "seen" flag and
// unmounts this. There is no ported "Сьогодні" stub: «Розпочати» simply dismisses to reveal the
// real Today screen underneath. Pure UI — touches no store/parse/condition logic.

import { useState } from "react";

type Priority = "high" | "med" | "low";
type ChipKind = "time" | "place" | "any";

type Mini = { text: string; priority: Priority; chip: { kind: ChipKind; label: string } };
type SlideData = {
  num: string;
  title: string;
  desc: string;
  said: string;
  minis: Mini[];
  note: string;
};

// Slide copy carries the post-geo-merge wording: slide 03 uses the reference's "version B"
// (autosurfacing is live), slide 02's chip is dateless («Середа, 15:00»), and every «вирине»
// is spelled with Cyrillic letters only.
const SLIDES: SlideData[] = [
  {
    num: "01 · запис",
    title: "Кажи все підряд — розберу",
    desc: "Не треба нічого формулювати. Диктуй або пиши потоком, як думається — кілька справ за раз, живою мовою.",
    said: "«завтра зранку подзвонити мамі, до п'ятниці купити квитки, і колись дочитати роман»",
    minis: [
      { text: "подзвонити мамі", priority: "med", chip: { kind: "time", label: "Завтра, зранку" } },
      { text: "купити квитки", priority: "high", chip: { kind: "time", label: "П'ятниця" } },
      { text: "дочитати роман", priority: "low", chip: { kind: "any", label: "Будь-коли" } },
    ],
    note: "Один потік — скільки завгодно намірів.",
  },
  {
    num: "02 · час",
    title: "Чує час, як ти його кажеш",
    desc: "«Завтра», «до п'ятниці», «о 18-й», «зранку», «наступного тижня» — розбирає живу мову, не форму з календарем.",
    said: "«у середу о 15:00 дедлайн по проєкту»",
    minis: [
      { text: "дедлайн по проєкту", priority: "high", chip: { kind: "time", label: "Середа, 15:00" } },
    ],
    note: "Чекатиме в «Заплановано» — і сам вирине свого дня.",
  },
  {
    num: "03 · місце",
    title: "Не тільки година. Ще й місце",
    desc: "Скажи місто — і намір сам вирине, коли ти там опинишся.",
    said: "«як буду у Львові — зайти в аптеку»",
    minis: [
      { text: "зайти в аптеку", priority: "med", chip: { kind: "place", label: "Львів" } },
    ],
    note: "Приїхав у Львів — воно вже в «Сьогодні».",
  },
  {
    num: "04 · будь-коли",
    title: "А дещо просто має бути зроблене",
    desc: "Без часу й місця — теж нормально. Такий намір не вигадує собі дату й не докоряє: він просто на видноті, поки не зробиш.",
    said: "«не забути передзвонити клієнту»",
    minis: [
      { text: "передзвонити клієнту", priority: "high", chip: { kind: "any", label: "Будь-коли" } },
    ],
    note: "Ніщо не згорає опівночі.",
  },
];

const LAST = SLIDES.length - 1;

// The clay CTA button shared by intro and deck (reference `.btn`).
const BTN_PRIMARY =
  "w-full rounded-card bg-clay px-4 py-4 text-base font-semibold text-white shadow-[0_8px_22px_rgba(180,100,63,0.28)] transition active:scale-[0.98]";

// ── thin linear glyphs (same family as the rest of the product) ──────────────

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 stroke-clay" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path d="M12 8v4l2.5 1.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PinGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 stroke-clay" aria-hidden>
      <path d="M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0116 0z" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" strokeWidth="1.8" />
    </svg>
  );
}
function DownGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className ?? "h-3 w-3 stroke-clay"} aria-hidden>
      <path d="M12 5v14M6 13l6 6 6-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChipIcon({ kind }: { kind: ChipKind }) {
  if (kind === "place") return <PinGlyph />;
  if (kind === "any") return <DownGlyph />;
  return <ClockGlyph />;
}

const PDOT: Record<Priority, string> = {
  high: "bg-clay",
  med: "bg-amber",
  low: "bg-sage",
};

function MiniCard({ mini }: { mini: Mini }) {
  return (
    <div className="mb-2 rounded-soft border border-line-soft bg-surface px-3 py-[11px] shadow-card last:mb-0">
      <div className="text-sm font-medium leading-snug text-ink">{mini.text}</div>
      <div className="mt-2 flex items-center gap-[7px]">
        <span className={`h-[7px] w-[7px] flex-none rounded-full ${PDOT[mini.priority]}`} aria-hidden />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-clay/20 bg-clay/[0.09] px-[9px] py-[3px] text-[11.5px] font-semibold text-ink-2">
          <ChipIcon kind={mini.chip.kind} />
          {mini.chip.label}
        </span>
      </div>
    </div>
  );
}

function Slide({ data, index, current }: { data: SlideData; index: number; current: number }) {
  const state = index === current ? "is-on" : index < current ? "is-left" : "";
  return (
    <section
      className={`mp-onb-slide absolute inset-0 flex flex-col overflow-y-auto px-[30px] pt-6 ${state}`}
      aria-hidden={index !== current}
    >
      <div className="mb-[13px] text-[11px] font-bold uppercase tracking-[0.22em] text-ink-3">{data.num}</div>
      <h2 className="mb-[11px] font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink">
        {data.title}
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-ink-2">{data.desc}</p>
      <div className="rounded-card bg-sink px-[15px] pb-[17px] pt-[15px]">
        <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.15em] text-ink-3">ти кажеш</div>
        <p className="border-l-2 border-clay-soft pl-[13px] font-display text-base italic leading-snug text-ink">
          {data.said}
        </p>
        <div className="my-3 flex justify-center text-ink-3">
          <DownGlyph className="h-[17px] w-[17px] stroke-ink-3" />
        </div>
        {data.minis.map((m, i) => (
          <MiniCard key={i} mini={m} />
        ))}
      </div>
      <p className="mt-[15px] pb-2 font-display text-[13px] italic leading-normal text-ink-3">{data.note}</p>
    </section>
  );
}

// ── the overlay ──────────────────────────────────────────────────────────────

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"intro" | "deck">("intro");
  const [cur, setCur] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  const goDeck = () => setPhase("deck");
  const next = () => (cur < LAST ? setCur((c) => c + 1) : onDone());

  const onTouchStart = (e: React.TouchEvent) => setTouchX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (dx < -45) setCur((c) => Math.min(LAST, c + 1));
    if (dx > 45) setCur((c) => Math.max(0, c - 1));
    setTouchX(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="Знайомство з Moment Planner"
    >
      <div className="mx-auto flex h-full max-w-md flex-col">
        {phase === "intro" ? (
          // Tap ANYWHERE on the intro advances to the deck; the buttons stop propagation so
          // «Пропустити» closes instead of advancing. Skip is always visible (no entrance delay),
          // so it's usable immediately without waiting for the animation.
          <div
            onClick={goDeck}
            className="relative flex h-full flex-col items-center justify-center px-8 text-center"
          >
            <div className="mb-[34px] flex items-center gap-3">
              <span className="mp-onb-dot block h-4 w-4 rounded-full bg-clay" />
              <span className="mp-onb-word font-display text-[27px] font-semibold tracking-tight text-ink">
                moment
              </span>
            </div>
            <div className="max-w-[300px] font-display text-[26px] leading-[1.28] tracking-tight text-ink">
              <span className="mp-onb-line block" style={{ animationDelay: "1.35s" }}>
                Не список справ.
              </span>
              <span className="mp-onb-line block italic text-ink-2" style={{ animationDelay: "1.65s" }}>
                Поле, де наміри чекають свого моменту.
              </span>
            </div>
            <p
              className="mp-onb-line mt-[22px] max-w-[290px] text-[14.5px] leading-relaxed text-ink-3"
              style={{ animationDelay: "2.15s" }}
            >
              Виклади все, що в голові — голосом чи текстом. Далі розберемось разом.
            </p>
            <div className="absolute inset-x-8 bottom-9">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goDeck();
                }}
                className={`mp-onb-line ${BTN_PRIMARY}`}
                style={{ animationDelay: "2.6s" }}
              >
                Далі
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDone();
                }}
                className="mt-1.5 block w-full py-3 text-sm font-semibold text-ink-3 transition active:text-ink-2"
              >
                Пропустити
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col pb-[30px] pt-2">
            <div className="flex flex-none items-center justify-between px-6 pt-1.5">
              <div className="flex items-center gap-2 font-display text-base font-semibold text-ink-2">
                <i className="block h-[9px] w-[9px] rounded-full bg-clay" />
                moment
              </div>
              <button
                type="button"
                onClick={onDone}
                className="p-1.5 text-[13px] font-semibold text-ink-3 transition active:text-ink-2"
              >
                Пропустити
              </button>
            </div>

            <div
              className="relative flex-1 overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {SLIDES.map((s, i) => (
                <Slide key={i} data={s} index={i} current={cur} />
              ))}
            </div>

            <div className="flex-none px-[30px] pt-[18px]">
              <div className="mb-[17px] flex justify-center gap-[7px]" aria-hidden>
                {SLIDES.map((_, i) => (
                  <span
                    key={i}
                    className={`h-[6px] rounded-full transition-all duration-300 ${
                      i === cur ? "w-5 bg-clay" : "w-[6px] bg-line"
                    }`}
                  />
                ))}
              </div>
              <button type="button" onClick={next} className={BTN_PRIMARY}>
                {cur === LAST ? "Розпочати" : "Далі"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Exported for tests that want to assert slide count/copy without reaching into the DOM.
export const ONBOARDING_SLIDES: ReadonlyArray<SlideData> = SLIDES;
export type { SlideData as OnboardingSlide };
