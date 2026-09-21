/**
 * The logo: the shop's name set in the display face, and nothing else.
 *
 * There is no mark beside it. The rounded-square Ս used to sit here, and carrying both meant the
 * logo said the name twice — once as a letter, once as a word. The icon still exists and is still
 * the app's: it is what a dock, a browser tab and a phone's home screen show, where a whole word
 * is unreadable at 16px. It is simply not part of the lockup any more.
 *
 * `font-display` is `--font-display` in theme.css, which falls back to Mardoto until the Slice
 * Brush file is added — so this renders in the UI face today rather than the brush script.
 */
import { t } from "@/i18n/t.ts";
import { cn } from "@/lib/cn.ts";

export function Wordmark({ className }: { className?: string }) {
  // A logo is a picture of the name, so it is one word to a screen reader, not a heading.
  return <span className={cn("font-display leading-none tracking-wide", className)}>{t("app.wordmark")}</span>;
}
