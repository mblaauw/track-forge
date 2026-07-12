import { useState, useEffect, useRef } from "preact/hooks";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Auto-save a value after a debounce delay.
 * Calls `save(value)` when the value stabilizes.
 * Returns current save status so UI can show feedback.
 */
export function useAutosave<T>(
  value: T,
  save: (val: T) => Promise<void>,
  delay = 300,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await save(value);
        if (mountedRef.current) setStatus("saved");
      } catch {
        if (mountedRef.current) setStatus("error");
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, save, delay]);

  return status;
}
