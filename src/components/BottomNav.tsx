"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCaptureSheet } from "@/components/CaptureSheet";

// Tab icons — the same thin linear family as the rest of the product, ported verbatim
// from the prototype nav: «Сьогодні» = a clock, «Заплановано» = a calendar. stroke uses
// currentColor so the tab's active/idle colour drives the icon.
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[23px] w-[23px]" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[23px] w-[23px]" aria-hidden>
      <rect x="4" y="5" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Step 2 shell: two destination tabs with a floating record button (FAB) centered
// between them. The FAB opens the Capture bottom sheet — it is *not* a route, so it
// stays reachable from both screens. The old third «Розбір» tab is gone; review now
// lives inside the sheet.
const TABS = [
  { href: "/today", label: "Сьогодні", icon: <ClockIcon /> },
  { href: "/planned", label: "Заплановано", icon: <CalendarIcon /> },
] as const;

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { open } = useCaptureSheet();

  return (
    // The nav wrapper is inert; only the control row re-enables pointer events. This lets the
    // decorative fade sit ABOVE scrolling cards without ever swallowing their taps.
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      {/* Bottom fade — ported from the prototype `.nav` gradient. Content dissolves softly
          under the navigation instead of meeting a hard border+plate. It is purely decorative
          and MUST stay pointer-events-none so taps pass through to the cards beneath it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,var(--color-paper)_62%,transparent)]"
      />

      <div className="pointer-events-auto relative mx-auto flex max-w-md">
        {/* left tab */}
        <NavTab tab={TABS[0]} active={pathname === TABS[0].href} />

        {/* center FAB */}
        <div className="flex flex-none items-center justify-center px-2">
          <button
            type="button"
            onClick={open}
            aria-label="Записати думки"
            className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full border-4 border-paper bg-clay text-white shadow-[0_10px_28px_rgba(180,100,63,0.42)] transition active:scale-95"
          >
            <PlusIcon />
          </button>
        </div>

        {/* right tab */}
        <NavTab tab={TABS[1]} active={pathname === TABS[1].href} />
      </div>
    </nav>
  );
}

function NavTab({
  tab,
  active,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={tab.href}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
        active ? "text-clay" : "text-ink-3"
      }`}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );
}
