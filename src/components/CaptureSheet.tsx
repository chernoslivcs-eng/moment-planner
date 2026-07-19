"use client";

// Capture → Розбір as a bottom sheet (Step 2 navigation shell).
// The sheet is a *presentation wrapper*: it reuses the exact same logic that the
// old /  and /inbox routes used (parseText, replaceCandidates, useCandidates,
// commitAllCandidates, …). Only the composition changes — two in-sheet steps
// instead of two route pages. No parsing/storage behaviour is altered.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { IntentCard } from "@/components/IntentCard";
import { ActionButton } from "@/components/ActionButton";
import { ParseError, parseText } from "@/lib/api";
import { EXAMPLE_BRAINDUMP } from "@/lib/example";
import { pluralizeIntents } from "@/lib/format";
import {
  commitAllCandidates,
  commitCandidate,
  removeCandidate,
  replaceCandidates,
  toggleCandidatePinToday,
  useCandidates,
} from "@/lib/store";

type SheetContext = { isOpen: boolean; open: () => void; close: () => void };

const Ctx = createContext<SheetContext | null>(null);

export function useCaptureSheet(): SheetContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCaptureSheet must be used within CaptureSheetProvider");
  return ctx;
}

export function CaptureSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  return (
    <Ctx.Provider value={{ isOpen, open, close }}>
      {children}
      <CaptureSheet isOpen={isOpen} close={close} />
    </Ctx.Provider>
  );
}

// ── the sheet itself ────────────────────────────────────────────────────────

type Step = "capture" | "review";

function CaptureSheet({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const candidates = useCandidates();
  const [step, setStep] = useState<Step>("capture");

  // On each open, land on the right step: if a review buffer already exists,
  // show it; otherwise start fresh at capture. (Read via ref to avoid resetting
  // the step every time candidates change mid-flow.)
  const candCount = useRef(candidates.length);
  candCount.current = candidates.length;
  useEffect(() => {
    if (isOpen) setStep(candCount.current > 0 ? "review" : "capture");
  }, [isOpen]);

  // Lock background scroll while the sheet is up.
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* scrim */}
      <button
        type="button"
        aria-label="Закрити"
        onClick={close}
        className={`fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92%] max-w-md flex-col rounded-t-[26px] bg-paper shadow-lift transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-3 mb-1 h-1 w-9 flex-none rounded-full bg-line" aria-hidden />
        <div className="overflow-y-auto px-5 pt-2 pb-8">
          {step === "capture" ? (
            <CaptureStep active={isOpen} onParsed={() => setStep("review")} />
          ) : (
            <ReviewStep onBack={() => setStep("capture")} onDone={close} />
          )}
        </div>
      </div>
    </>
  );
}

// ── step 1: capture ─────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M6 11a6 6 0 0012 0M12 17v4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Voice input: progressive enhancement over the text field ──────────────────
// Voice is an UPGRADE, never a replacement. The Web Speech API (webkit-prefixed on
// Chromium) is not in lib.dom's typings, so we declare the minimal surface we use.
// Everything below is feature-detected at runtime; where the API is absent (iOS
// Safari, and Chrome-on-iOS which is WebKit under the hood) the mic is hidden and
// the text field remains the sole, always-working path.
type SpeechAlt = { transcript: string };
type SpeechResult = { isFinal: boolean; readonly length: number; [index: number]: SpeechAlt };
type SpeechResultList = { readonly length: number; [index: number]: SpeechResult };
type SpeechResultEvent = { resultIndex: number; results: SpeechResultList };
type SpeechErrEvent = { error: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// The one place we probe support. Returns the constructor or null — never throws on SSR.
function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type VoiceCapture = {
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
  stop: () => void;
};

// Drives recognition and streams the transcript INTO the same capture field. Recognized
// speech simply fills the textarea; from there it follows the identical «Розібрати» path.
function useVoiceCapture(
  setText: Dispatch<SetStateAction<string>>,
  textRef: { current: string },
): VoiceCapture {
  // Detect on mount (client-only) so the server-rendered HTML — which never shows the mic —
  // matches first paint and no hydration mismatch fires. We flip support on after mount.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(""); // finalized transcript for this session
  const baseRef = useRef(""); // field text that was already there when recording began

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getSpeechRecognitionCtor() != null);
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = rec.onstart = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = "uk-UA";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    baseRef.current = textRef.current.trimEnd() ? `${textRef.current.trimEnd()} ` : "";

    rec.onstart = () => {
      setError(null);
      setListening(true);
    };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const chunk = res[0]?.transcript ?? "";
        if (res.isFinal) finalRef.current += chunk;
        else interim += chunk;
      }
      const spoken = `${finalRef.current}${interim}`.replace(/\s+/g, " ").trimStart();
      setText(baseRef.current + spoken);
    };
    rec.onerror = (ev) => {
      // Permission refused → fall back to text with a gentle, non-blocking hint.
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setError("Немає доступу до мікрофона — просто впиши текст нижче.");
      }
      // Any other error (no-speech, aborted, network) just ends the session quietly.
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      stop();
    }
  }, [setText, textRef, stop]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // Always release the mic when this step unmounts (parse success, back to review, etc.).
  useEffect(() => () => stop(), [stop]);

  return { supported, listening, error, toggle, stop };
}

// Seven-bar equalizer — the prototype's "the product is hearing you" cue. Purely decorative.
function Equalizer() {
  const delays = [0, 0.12, 0.24, 0.36, 0.2, 0.3, 0.08];
  return (
    <span className="flex h-[22px] flex-none items-end gap-[3px]" aria-hidden>
      {delays.map((d, i) => (
        <span key={i} className="mp-eq-bar" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

function CaptureStep({ active, onParsed }: { active: boolean; onParsed: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest field text reachable from the voice session without re-creating it.
  const textRef = useRef(text);
  textRef.current = text;
  const voice = useVoiceCapture(setText, textRef);

  // Closing the sheet keeps this step mounted (it only slides off-screen), so stop the mic
  // explicitly when it goes inactive — never leave recognition running behind a closed sheet.
  useEffect(() => {
    if (!active) voice.stop();
  }, [active, voice]);

  const canParse = text.trim().length >= 2 && !loading;

  async function handleParse() {
    if (!canParse) return;
    voice.stop();
    setLoading(true);
    setError(null);
    try {
      const intents = await parseText(text);
      if (intents.length === 0) {
        setError("Не вдалося виділити жодного наміру. Спробуй сформулювати конкретніше.");
        return;
      }
      // A fresh parse REPLACES the review buffer (clears any stale, unconfirmed
      // candidates from an earlier parse) so near-duplicate fragments can't pile up.
      replaceCandidates(intents);
      setText("");
      onParsed();
    } catch (e) {
      const message =
        e instanceof ParseError ? e.message : "Щось пішло не так. Спробуй ще раз.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mt-1 font-display text-[23px] font-semibold text-ink">Що в голові?</h2>
      <p className="mt-1 mb-4 text-[13.5px] leading-relaxed text-ink-2">
        Вивали все підряд — одним потоком, як думається. Розкладу на наміри сам.
      </p>

      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="напр. купити квитки, подзвонити мамі ввечері, відповісти щодо сценарію…"
          rows={5}
          className="w-full resize-none bg-transparent font-display text-[19px] leading-relaxed text-ink outline-none placeholder:italic placeholder:text-ink-3"
        />
        {voice.supported ? (
          // Web Speech is live (Chromium desktop): active mic + equalizer + live hint.
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={voice.toggle}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Зупинити запис" : "Записати голосом"}
              className={`flex h-12 w-12 flex-none items-center justify-center rounded-full border shadow-card transition active:scale-95 ${
                voice.listening
                  ? "animate-pulse border-clay bg-clay text-white"
                  : "border-line bg-surface text-clay"
              }`}
            >
              <MicIcon />
            </button>
            {voice.listening ? <Equalizer /> : null}
            <p className="font-display text-[12.5px] italic leading-snug text-ink-3">
              {voice.error
                ? voice.error
                : voice.listening
                  ? "Слухаю… говори; тапни ще раз, щоб зупинити."
                  : "Тапни мікрофон і говори — або впиши текст."}
            </p>
          </div>
        ) : (
          // No Web Speech API (iOS Safari, Chrome-on-iOS = WebKit): hide the mic entirely —
          // no broken control, no error. Text stays the always-available path.
          <p className="mt-3 font-display text-[12.5px] italic leading-snug text-ink-3">
            Постав приклад або впиши свій потік.
          </p>
        )}
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-soft border border-clay/25 bg-clay/8 p-3 text-sm text-ink-2">
          <span aria-hidden>⚠️</span>
          <div className="flex-1">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleParse}
              disabled={!canParse}
              className="mt-2 font-semibold text-clay underline underline-offset-2 disabled:opacity-50"
            >
              Спробувати ще раз
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            setText(EXAMPLE_BRAINDUMP);
            setError(null);
          }}
          disabled={loading}
          className="flex-1 rounded-card border border-line px-4 py-3.5 text-[15px] font-semibold text-ink-2 transition active:scale-[0.98] disabled:opacity-40"
        >
          Спробувати приклад
        </button>
        <button
          type="button"
          onClick={handleParse}
          disabled={!canParse}
          className="flex-1 rounded-card bg-clay px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_rgba(180,100,63,0.28)] transition active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? "Розбираю…" : "Розібрати"}
        </button>
      </div>
    </>
  );
}

// ── step 2: review (Розбір) ──────────────────────────────────────────────────

function ReviewStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const candidates = useCandidates();
  const now = new Date();

  if (candidates.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-lg text-ink-2">Нема чого підтверджувати</p>
        <p className="mt-1 text-sm text-ink-3">Повернись і запиши думки.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 rounded-card border border-line px-5 py-3 text-[15px] font-semibold text-ink-2"
        >
          Назад до запису
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="mt-1 font-display text-[23px] font-semibold text-ink">Ось як я почув</h2>
      <p className="mt-1 mb-4 text-[13.5px] leading-relaxed text-ink-2">
        Перевір кожен намір до збереження. Познач у сьогодні, виконане чи відпусти.
      </p>

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

      <div className="mt-6 flex gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-card border border-line px-5 py-3.5 text-[15px] font-semibold text-ink-2 transition active:scale-[0.98]"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={() => {
            commitAllCandidates();
            onDone();
          }}
          className="flex-1 rounded-card bg-clay px-4 py-3.5 text-[15px] font-semibold text-white shadow-lift transition active:scale-[0.98]"
        >
          Підтвердити {candidates.length} {pluralizeIntents(candidates.length)}
        </button>
      </div>
    </>
  );
}
