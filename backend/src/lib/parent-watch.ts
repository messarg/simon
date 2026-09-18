/**
 * Exits with the app that started us. The Mac app launches this server as a child process and
 * stops it on a normal quit — but a crash, a force-quit or a `kill` skips that, and the server
 * would live on under launchd, holding the port with whatever build it was. The next launch then
 * found *something* answering and used it: an old build, silently (desktop/macos/main.swift).
 *
 * When the parent dies, the kernel hands us to a new one, so `process.ppid` changes. Watching for
 * that needs no signal from the parent, which is the point: the parent is what failed.
 */
export function watchParent(opts: {
  /** The pid we were started by; 0 or absent when nothing asked us to watch (a shop install). */
  expected: number;
  onGone: () => void;
  intervalMs?: number;
  currentParent?: () => number;
}): () => void {
  if (!opts.expected) return () => {};
  const current = opts.currentParent ?? (() => process.ppid);
  const timer = setInterval(() => {
    if (current() !== opts.expected) {
      clearInterval(timer);
      opts.onGone();
    }
  }, opts.intervalMs ?? 2_000);
  timer.unref();
  return () => clearInterval(timer);
}
