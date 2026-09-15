/**
 * HID keyboard-wedge scanner. PRD §6.1, §18; the barcode skill.
 *
 * A wedge scanner is a keyboard that types very fast and presses Enter. Listen at the document,
 * decide by timing, and stay out of the way while a person is typing in a field.
 */
import { useEffect, useRef } from "react";

export const SCAN_MAX_GAP_MS = 50;
export const SCAN_MIN_LENGTH = 4;

export interface ScanBuffer { chars: string; last: number; }

/** Pure step: returns the completed code on Enter, or null. Exported for tests. */
export function feed(buf: ScanBuffer, key: string, at: number): string | null {
  if (at - buf.last > SCAN_MAX_GAP_MS) buf.chars = "";
  buf.last = at;
  if (key === "Enter") {
    const code = buf.chars;
    buf.chars = "";
    return code.length >= SCAN_MIN_LENGTH ? code : null;
  }
  if (key.length === 1) buf.chars += key;
  return null;
}

function typingInField() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || el.getAttribute("role") === "dialog";
}

export function useScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan);
  useEffect(() => { handler.current = onScan; }, [onScan]);
  useEffect(() => {
    if (!enabled) return;
    const buf: ScanBuffer = { chars: "", last: 0 };
    let lastCode = "";
    let lastAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (typingInField() || e.ctrlKey || e.metaKey || e.altKey) return;
      // The event's own timestamp, not the handler's clock: a busy main thread delays handlers,
      // and measuring that delay would split one scan into two.
      const now = e.timeStamp;
      const code = feed(buf, e.key, now);
      if (code === null) return;
      e.preventDefault();
      // Scanners double-fire; ignore the same code within 300 ms.
      if (code === lastCode && now - lastAt < 300) return;
      lastCode = code;
      lastAt = now;
      handler.current(code);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
