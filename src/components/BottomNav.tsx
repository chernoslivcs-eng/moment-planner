"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCandidates } from "@/lib/store";

const TABS = [
  { href: "/", label: "Запис", emoji: "✍️" },
  { href: "/inbox", label: "Розбір", emoji: "📥" },
  { href: "/today", label: "Сьогодні", emoji: "☀️" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const candidates = useCandidates();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const showBadge = tab.href === "/inbox" && candidates.length > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                active ? "text-stone-900" : "text-stone-400"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {tab.emoji}
              </span>
              {tab.label}
              {showBadge ? (
                <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {candidates.length}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
