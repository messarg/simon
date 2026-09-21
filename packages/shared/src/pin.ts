/**
 * The PIN's shape, in one place (PRD §16.2).
 *
 * It used to be written four times — the domain policy, the request schema, the wizard's validity
 * check and the keypad's defaults — which is three chances for the client to accept what the server
 * refuses, or the reverse. It lives here for the same reason the money rules do: both sides have to
 * agree, so there is one copy and both import it.
 *
 * Six digits, exactly. Not a range: a four-digit PIN is 10,000 guesses, and while §16.2's lockout
 * makes that unguessable online, the PIN is also what re-authorises a discount above the cap and a
 * blind return (§16.3) — typed in front of whoever asked for it. Six digits is the shortest one
 * that is not watched over a shoulder and memorised on the spot, and it stays a number, because the
 * people typing it are standing at a counter, not sitting at a desk.
 */
export const PIN_LENGTH = 6;

/** Anchored, no flags: a shared `RegExp` with `g` would carry `lastIndex` between callers. */
export const PIN_PATTERN = /^\d{6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

/** Strips anything a keyboard, a scanner or a paste can add, and stops at the PIN's length. */
export function normalisePinInput(raw: string): string {
  return raw.replace(/\D/gu, "").slice(0, PIN_LENGTH);
}
