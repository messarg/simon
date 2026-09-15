/**
 * Connection state, measured rather than asked. PRD §14.4.
 *
 * `navigator.onLine` says the phone is associated with Wi-Fi, which is not the question.
 * The till probes `/api/health` and goes offline after N consecutive failures (§6.11,
 * default 2) or when a probe exceeds the scan-path latency threshold (default 1.5 s).
 * Degraded fails fast into the offline path that already works.
 */
import { useSyncExternalStore } from "react";

export type ConnectionState = "online" | "offline";

let state: ConnectionState = "online";
let failures = 0;
let failureThreshold = 2;
let latencyMs = 1500;
const listeners = new Set<() => void>();

function set(next: ConnectionState) {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
}

export const connection = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  configure(opts: { failureThreshold?: number; latencyMs?: number }) {
    failureThreshold = opts.failureThreshold ?? failureThreshold;
    latencyMs = opts.latencyMs ?? latencyMs;
  },
  /** Any request can report in; the probe is only the fallback. */
  reportSuccess() { failures = 0; set("online"); },
  reportFailure() { failures++; if (failures >= failureThreshold) set("offline"); },
  async probe(): Promise<ConnectionState> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), latencyMs);
    try {
      const res = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
      if (res.ok) connection.reportSuccess(); else connection.reportFailure();
    } catch {
      connection.reportFailure();
    } finally {
      clearTimeout(timer);
    }
    return state;
  },
  start(intervalMs = 5000) {
    void connection.probe();
    const id = setInterval(() => void connection.probe(), intervalMs);
    const wake = () => void connection.probe();
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => { clearInterval(id); window.removeEventListener("online", wake); window.removeEventListener("focus", wake); };
  },
};

export function useConnection() {
  return useSyncExternalStore(connection.subscribe, connection.get);
}
