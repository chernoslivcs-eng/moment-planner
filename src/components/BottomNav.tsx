"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCaptureSheet } from "@/components/CaptureSheet";

// Step 2 shell: two destination tabs with a floating record button (FAB) centered
// between them. The FAB opens the Capture bottom sheet — it is *not* a route, so it
// stays reachable from both screens. The old third «Розбір» tab is gone; review now
// lives inside the sheet.
const TABS = [
  { href: "/today", label: "Сьогодні", emoji: "☀️" },
  { href: "/planned", label: "Заплановано", emoji: "🗓️" },
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-md">
        {/* left tab */}
        <NavTab tab={TABS[0]} active={pathname === TABS[0].href} />

        {/* center FAB */}
        <div className="flex flex-none items-center justify-center px-2">
          <button
            type="button"
            onClick={open}
            aria-label="Записати думки"
            className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-clay text-white shadow-[0_10px_28px_rgba(180,100,63,0.42)] transition active:scale-95"
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
      <span className="text-lg" aria-hidden>
        {tab.emoji}
      </span>
      {tab.label}
    </Link>
  );
}
