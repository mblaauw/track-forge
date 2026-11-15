/**
 * Shared UI primitives. Every control in the studio is built from these so
 * that focus, sizing and states behave the same everywhere.
 */
import { createContext, type ComponentChildren, type JSX } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { X } from "@phosphor-icons/react";

/* ── Segmented control (single choice, radio semantics) ─────────────── */

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  size = "md",
  wrap = false,
  testId,
}: {
  /** Accessible name for the group. */
  label: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Let options wrap onto several rows instead of sharing one. */
  wrap?: boolean;
  testId?: (value: T) => string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  // Arrow keys change the choice; focus follows it once it has rendered.
  const followFocus = useRef(false);
  useLayoutEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    groupRef.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.focus();
  }, [value]);

  const move = (e: KeyboardEvent, index: number) => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(index + delta + options.length) % options.length]!;
    followFocus.current = true;
    onChange(next.value);
  };

  const noneChosen = !options.some((o) => o.value === value);

  return (
    <div
      ref={groupRef}
      class={`seg seg-${size}${wrap ? " seg-wrap" : ""}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        // With nothing chosen yet, the first option keeps the group in
        // the tab order.
        const tabbable = on || (noneChosen && i === 0);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={tabbable ? 0 : -1}
            class={`seg-opt${on ? " on" : ""}`}
            title={o.title}
            data-testid={testId?.(o.value)}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Switch ─────────────────────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; the visible label sits next to the switch. */
  label: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class={`switch${checked ? " on" : ""}`}
      data-testid={testId}
      onClick={() => onChange(!checked)}
    >
      <span class="switch-knob" />
    </button>
  );
}

/* ── Popover ────────────────────────────────────────────────────────── */

/**
 * A button that opens a panel anchored beneath it. Closes on outside
 * click and Escape, and returns focus to the trigger.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  panelClass = "",
  label,
}: {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: (el: HTMLElement | null) => void;
    "aria-expanded": boolean;
    "aria-haspopup": "dialog";
  }) => JSX.Element;
  children: (close: () => void) => ComponentChildren;
  align?: "start" | "end";
  panelClass?: string;
  /** Accessible name for the panel. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Move focus into the panel so keyboard users land on its first control.
    const first = wrapRef.current?.querySelector<HTMLElement>(
      ".popover [autofocus], .popover input, .popover button",
    );
    first?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div class="popover-wrap" ref={wrapRef}>
      {trigger({
        open,
        toggle: () => setOpen((o) => !o),
        ref: (el) => {
          triggerRef.current = el;
        },
        "aria-expanded": open,
        "aria-haspopup": "dialog",
      })}
      {open && (
        <div
          class={`popover popover-${align} ${panelClass}`}
          role="dialog"
          aria-label={label}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/* ── Field ──────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  aside,
  children,
}: {
  label: string;
  hint?: ComponentChildren;
  /** Sits at the right end of the label row (a count, a reset link…). */
  aside?: ComponentChildren;
  children: (id: string) => ComponentChildren;
}) {
  const id = useId();
  return (
    <div class="field">
      <div class="field-head">
        <label class="field-label" for={id}>
          {label}
        </label>
        {aside && <span class="field-aside">{aside}</span>}
      </div>
      {children(id)}
      {hint && <p class="field-hint">{hint}</p>}
    </div>
  );
}

/* ── Character budget ───────────────────────────────────────────────── */

export function Budget({
  used,
  max,
  testId,
}: {
  used: number;
  max: number;
  testId?: string;
}) {
  const over = used > max;
  return (
    <span class={`budget${over ? " over" : ""}`} data-testid={testId}>
      {used.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

/* ── Toasts (with an optional undo action) ──────────────────────────── */

interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
}

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastHost({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      // One at a time: a new message replaces the last, so an undo always
      // refers to the action the user just took.
      setToasts([{ ...t, id }]);
      setTimeout(() => dismiss(id), t.onAction ? 8000 : 4500);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div class="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            class={`toast${t.tone === "error" ? " toast-error" : ""}`}
            role="status"
          >
            <span>{t.message}</span>
            {t.onAction && (
              <button
                type="button"
                class="toast-action"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel ?? "Undo"}
              </button>
            )}
            <button
              type="button"
              class="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Formatting helpers ─────────────────────────────────────────────── */

export function formatClock(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const whole = Math.round(totalSec);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
}

/** "SOUND DESIGN" → "Sound design" (config labels are stored in capitals). */
export function sentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
