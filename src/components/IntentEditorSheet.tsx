"use client";

// Крок 6 · Ланка 2 — Хост єдиного редактора для ЗБЕРЕЖЕНИХ намірів. Bottom-sheet (те саме
// оформлення, що й CaptureSheet), піднятий над усім застосунком: будь-яка картка на «Сьогодні»/
// «Заплановано» відкриває його тапом по тексту через useIntentEditor().open(intent). На «Готово»
// кличемо updateIntent(id, edit) — і emit() у сторі сам тригерить перерахунок buildToday на
// сторінках, тож змінений намір переїздить у потрібну секцію без окремого механізму (Ланка 3).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { IntentEditor } from "@/components/IntentEditor";
import { updateIntent } from "@/lib/store";
import type { Intent, IntentEdit } from "@/lib/types";

type EditorContext = { open: (intent: Intent) => void };

const Ctx = createContext<EditorContext | null>(null);

export function useIntentEditor(): EditorContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIntentEditor must be used within IntentEditorProvider");
  return ctx;
}

export function IntentEditorProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Intent | null>(null);
  const open = (intent: Intent) => setEditing(intent);
  const close = () => setEditing(null);

  // Lock background scroll while the sheet is up.
  useEffect(() => {
    document.body.style.overflow = editing ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [editing]);

  function handleSave(edit: IntentEdit) {
    if (editing) updateIntent(editing.id, edit);
    close();
  }

  return (
    <Ctx.Provider value={{ open }}>
      {children}

      {/* scrim */}
      <button
        type="button"
        aria-label="Закрити"
        onClick={close}
        className={`fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          editing ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Виправити намір"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92%] max-w-md flex-col rounded-t-[26px] bg-paper shadow-lift transition-transform duration-300 ease-out ${
          editing ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-3 mb-1 h-1 w-9 flex-none rounded-full bg-line" aria-hidden />
        <div className="overflow-y-auto px-5 pt-2 pb-8">
          {editing ? (
            <IntentEditor
              // key on id so the working copy resets cleanly when a different intent opens.
              key={editing.id}
              intent={editing}
              now={new Date()}
              onSave={handleSave}
              onCancel={close}
            />
          ) : null}
        </div>
      </div>
    </Ctx.Provider>
  );
}
