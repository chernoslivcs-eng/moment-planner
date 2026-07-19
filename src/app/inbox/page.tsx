"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IntentCard } from "@/components/IntentCard";
import { EmptyState } from "@/components/EmptyState";
import { ActionButton } from "@/components/ActionButton";
import { pluralizeIntents } from "@/lib/format";
import {
  commitAllCandidates,
  commitCandidate,
  removeCandidate,
  toggleCandidatePinToday,
  useCandidates,
} from "@/lib/store";

export default function InboxPage() {
  const router = useRouter();
  const candidates = useCandidates();
  const now = new Date();

  if (candidates.length === 0) {
    return (
      <main className="flex flex-1 flex-col">
        <EmptyState
          emoji="📥"
          title="Тут порожньо"
          hint="Запиши потік думок на екрані «Запис» — і я розкладу його на наміри для підтвердження."
          action={
            <Link
              href="/"
              className="mt-2 rounded-card bg-clay px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(180,100,63,0.28)]"
            >
              До запису
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-10">
      <header className="mb-5 pt-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">
          Розбір
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
          Ось як я зрозумів кожен намір. Перевір до збереження — виправити можна одним рухом.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {candidates.map((c) => (
          <IntentCard
            key={c.cid}
            text={c.text}
            priority={c.priority}
            condition={c.condition}
            now={now}
            state="today"
            actions={
              <>
                <ActionButton onClick={() => commitCandidate(c.cid, "done")}>
                  ✓ Виконано
                </ActionButton>
                <ActionButton
                  tone="accent"
                  active={!!c.pinToday}
                  onClick={() => toggleCandidatePinToday(c.cid)}
                >
                  ☀️ В сьогодні
                </ActionButton>
                <ActionButton tone="danger" onClick={() => removeCandidate(c.cid)}>
                  Відпустити
                </ActionButton>
              </>
            }
          />
        ))}
      </div>

      <div className="sticky bottom-24 mt-6">
        <button
          type="button"
          onClick={() => {
            commitAllCandidates();
            router.push("/today");
          }}
          className="flex h-12 w-full items-center justify-center rounded-card bg-clay px-6 text-[15px] font-semibold text-white shadow-lift transition active:scale-[0.99]"
        >
          Підтвердити {candidates.length} {pluralizeIntents(candidates.length)}
        </button>
      </div>
    </main>
  );
}
