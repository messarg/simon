/** Which screen a route is, for its two-sentence explanation and its one-time coach mark (§7.5). */
import type { hy } from "@/i18n/hy.ts";

export type HelpScreen = keyof typeof hy.help.screens;

export function screenFor(pathname: string): HelpScreen | null {
  const path = pathname.split("?")[0];
  if (path.startsWith("/sell")) return "till";
  if (path.startsWith("/shift")) return "shift";
  if (path.startsWith("/debts") || path.startsWith("/customers")) return "debts";
  if (path.startsWith("/stock")) return "stock";
  if (path.startsWith("/home")) return "home";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/staff")) return "staff";
  if (path.startsWith("/settings")) return "settings";
  return null;
}
