/** Audible feedback: workers are not looking at the screen while scanning (§6.1). */
let ctx: AudioContext | null = null;

export function beep(kind: "ok" | "error" = "ok") {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === "ok" ? 1320 : 330;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (kind === "ok" ? 0.08 : 0.25));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === "ok" ? 0.09 : 0.26));
    if (kind === "error") navigator.vibrate?.(120);
  } catch { /* audio unavailable: the line appearing is still feedback */ }
}
