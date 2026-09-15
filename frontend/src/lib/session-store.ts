/**
 * The signed-in session, in memory with a sessionStorage copy so a reload keeps the till
 * signed in. Never the PIN (§16.2). The device id lives in localStorage because a device is
 * durable and a session is not (§11 `Device`).
 */
import { useSyncExternalStore } from "react";
import type { Role, SessionMode } from "@simon/shared";

export interface SessionState {
  token: string;
  user: { id: string; name: string; role: Role };
  session: { id: string; mode: SessionMode; expiresAt: string; shiftId: string | null };
  /** Set when this session's shift closed: the server has revoked it, but the Z-report is still on screen (§16.3). */
  endedByShiftClose?: boolean;
  device: { id: string; prefix: string; label: string; lastSequence: number };
}

const KEY = "simon.session";
const DEVICE_KEY = "simon.deviceId";
const listeners = new Set<() => void>();

function load(): SessionState | null {
  try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as SessionState) : null; } catch { return null; }
}

let current: SessionState | null = load();

export const sessionStore = {
  get: () => current,
  set(next: SessionState | null) {
    current = next;
    try {
      if (next) { sessionStorage.setItem(KEY, JSON.stringify(next)); localStorage.setItem(DEVICE_KEY, next.device.id); }
      else sessionStorage.removeItem(KEY);
    } catch { /* private mode: in-memory only */ }
    listeners.forEach((l) => l());
  },
  patch(fn: (s: SessionState) => SessionState) { if (current) sessionStore.set(fn(current)); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  deviceId(): string | null { try { return localStorage.getItem(DEVICE_KEY); } catch { return null; } },
};

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
}
