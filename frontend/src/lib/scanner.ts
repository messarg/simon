/**
 * HID keyboard-wedge scanner. PRD §6.1, §18; the barcode skill.
 *
 * A wedge scanner is a keyboard that types very fast and presses Enter. Listen at the document,
 * decide by timing, and stay out of the way while a person is typing in a field.
 */
import { useEffect, useRef } from "react";

export const SCAN_MAX_GAP_MS = 50;
export const SCAN_MIN_LENGTH = 4;
/** A pause this long means a person, not a scanner: whatever came before is not part of the next code. */
export const SCAN_RESET_MS = 1000;

export interface ScanBuffer { chars: string; times: number[]; last: number; }

export const newScanBuffer = (): ScanBuffer => ({ chars: "", times: [], last: 0 });

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Pure step: returns the completed code on Enter, or null. Exported for tests.
 *
 * Decides by the burst's *median* key gap, not by any single gap: a busy main thread or a
 * Bluetooth stutter can delay one key past 50 ms, and treating that as the start of a new code
 * drops the digits before it — a scan that silently turns into an unknown barcode.
 */
export function feed(buf: ScanBuffer, key: string, at: number): string | null {
  if (at - buf.last > SCAN_RESET_MS) { buf.chars = ""; buf.times = []; }
  buf.last = at;
  if (key === "Enter") {
    const code = buf.chars;
    const gaps = buf.times.slice(1).map((t, i) => t - buf.times[i]);
    buf.chars = "";
    buf.times = [];
    if (code.length < SCAN_MIN_LENGTH || gaps.length === 0) return null;
    return median(gaps) <= SCAN_MAX_GAP_MS ? code : null;
  }
  if (key.length === 1) { buf.chars += key; buf.times.push(at); }
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
    const buf = newScanBuffer();
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
