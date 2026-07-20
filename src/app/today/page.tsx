"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { TodaySections } from "@/components/TodaySections";
import { DayLoadLine } from "@/components/DayLoadLine";
import { currentContext } from "@/lib/conditions/context";
import { estimateTodayMinutes } from "@/lib/realism";
import { buildToday, type TodayView } from "@/lib/today";
import { pluralizeIntents } from "@/lib/format";
import { useIntents } from "@/lib/store";
import { useCurrentCity } from "@/lib/geo/currentCity";

// Ambient marks that sit to the RIGHT of «Сьогодні» (prototype `.ctx`): a place pin and a
// weather cloud, in the same thin linear family (ink-3, 1.7 stroke) as the rest of the product.
function PinGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M20 10c0 6-8 11-8 11s-8-5-8-11a8 8 0 0116 0z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CloudGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M17 18a4 4 0 000-8 6 6 0 00-11.3 2A3.5 3.5 0 006 18z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

// The empty-state glyph — a thin downward arrow (prototype `I.down`), NOT an emoji.
function ArrowDownGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden>
      <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Ambient cluster: live current city + a MUTED, decorative weather mark (weather is not built —
// never a fake reading). The whole cluster stays hidden until the real city resolves; if geo is
// silent or still resolving we show nothing here — no hardcoded «Київ» placeholder.
function Ambient({ city }: { city: string | null }) {
  if (!city) return null;
  return (
    <div className="flex flex-none items-center gap-2.5">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-ink-3">
        <PinGlyph />
        {city}
      </span>
      {/* Погода — ще не реалізована: приглушений декоративний значок, не живі дані. */}
      <span className="inline-flex items-center text-ink-3/40" aria-hidden title="Погода — скоро">
        <CloudGlyph />
      </span>
    </div>
  );
}

export default function TodayPage() {
  const intents = useIntents();
  const [view, setView] = useState<TodayView>({ active: [], overdue: [] });
  // Current city (real geolocation → reverse-geocoding). null until resolved / if geo is silent.
  const city = useCurrentCity();
  const now = new Date();

  // Re-evaluate on every trigger (mount, tab focus, visibility) — never a one-shot compute
  // at startup (roadmap §2, requirement 3). Membership is derived fresh each time. Re-runs when
  // the city resolves so a matching city intent surfaces the moment we know where we are.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      buildToday(intents, currentContext(city)).then((v) => {
        if (!cancelled) setView(v);
      });
    };
    run();
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [intents, city]);

  const isEmpty = view.active.length === 0 && view.overdue.length === 0;

  // Live italic subtitle (prototype `.date`): weekday + day + month. When the plan is empty the
  // subtitle is just the date (no count, matching the prototype); otherwise it carries the count.
  const activeCount = view.active.length;
  const dayLabel = new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const daySubtitle = isEmpty
    ? dayLabel
    : `${dayLabel} — виринуло ${activeCount} ${pluralizeIntents(activeCount)}`;

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      {/* Full header stays in EVERY state (prototype): eyebrow + «Сьогодні» + ambient + date. */}
      <header className="mb-5 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
          Момент настав
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="font-display text-[33px] font-semibold leading-[1.05] tracking-tight text-ink">
            Сьогодні
          </h1>
          <Ambient city={city} />
        </div>
        <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-ink-2">
          {daySubtitle}
        </p>
        {/* Тиха реалістичність дня (Крок 5): констатує приблизну вагу сьогоднішніх намірів під
            датою. Сама ховається, коли ваги нема (порожній / усе-null день). */}
        {!isEmpty ? <DayLoadLine minutes={estimateTodayMinutes(view)} /> : null}
      </header>

      {isEmpty ? (
        // Empty message sits UNDER the header (not instead of it), with the linear arrow glyph.
        <EmptyState
          glyph={<ArrowDownGlyph />}
          title="Сьогодні тут спокійно"
          hint="Коли настане момент якогось наміру — він сам виринає сюди, готовий до дії. А поки що ніщо не тисне."
        />
      ) : (
        <TodaySections view={view} now={now} />
      )}
    </main>
  );
}
