/**
 * PIN lockout and rate limiting. PRD §16.2, §27.39.
 *
 * 5 consecutive failures lock the user for 15 minutes (423). Attempts are limited to 10
 * per minute per device (429). The lock is per user, so the next worker still signs in.
 */
export const PIN_PATTERN = /^\d{4,8}$/;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;
export const ATTEMPTS_PER_MINUTE = 10;

export interface LockState {
  failedAttempts: number;
  lockedUntil: string | null;
}

export function isLocked(s: LockState, now: Date): boolean {
  return s.lockedUntil !== null && Date.parse(s.lockedUntil) > now.getTime();
}

export function minutesRemaining(s: LockState, now: Date): number {
  if (!isLocked(s, now)) return 0;
  return Math.ceil((Date.parse(s.lockedUntil!) - now.getTime()) / 60_000);
}

export function afterAttempt(s: LockState, ok: boolean, now: Date): LockState & { attemptsRemaining: number } {
  if (ok) return { failedAttempts: 0, lockedUntil: null, attemptsRemaining: MAX_FAILURES };
  // A lock that has expired starts a fresh count.
  const base = s.lockedUntil !== null && !isLocked(s, now) ? 0 : s.failedAttempts;
  const failedAttempts = base + 1;
  const lockedUntil = failedAttempts >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;
  return { failedAttempts: lockedUntil ? 0 : failedAttempts, lockedUntil, attemptsRemaining: Math.max(0, MAX_FAILURES - failedAttempts) };
}

/** Sliding one-minute window per device key. In memory: a restart forgets it, the lock does not. */
export class DeviceRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  constructor(limit: number = ATTEMPTS_PER_MINUTE) {
    this.limit = limit;
  }
  /** Seconds to wait, or 0 when allowed (and the attempt is counted). */
  take(key: string, now: number): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return Math.ceil((60_000 - (now - recent[0])) / 1000);
    }
    recent.push(now);
    this.hits.set(key, recent);
    return 0;
  }
}
