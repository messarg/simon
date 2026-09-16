/**
 * Փորձնական (§7.2, §19.4). The toggle is per person and per device: one worker practising must not
 * put the shop into practice mode. Everything cached for the real shop is dropped on the way in and
 * on the way out, because the two databases answer the same questions differently.
 */
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/i18n/t.ts";
import { localDb } from "@/lib/local-db.ts";
import { clearCatalogue } from "@/lib/catalogue.ts";
import { clearCustomers } from "@/lib/customers.ts";
import { outbox } from "@/lib/outbox.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { problemMessage } from "@/i18n/t.ts";
import { sessionStore } from "@/lib/session-store.ts";

async function basketIsOpen() {
  const db = await localDb();
  const basket = (await db.get("basket", "current")) as { lines?: unknown[] } | undefined;
  return Boolean(basket?.lines?.length);
}

async function forgetLocalState() {
  const db = await localDb();
  await db.delete("basket", "current");
  await clearCatalogue();
  await clearCustomers();
}

export function usePracticeMode() {
  const qc = useQueryClient();
  const session = sessionStore.get();
  const mode = session?.session.mode ?? "LIVE";

  const switchTo = async (next: "LIVE" | "PRACTICE") => {
    // Two baskets that look identical and mean different things is the confusion rule 7 prevents (§19.4).
    if (await basketIsOpen()) {
      toast.error(t("practice.basketOpen"));
      return false;
    }
    try {
      await http.post("/session/mode", { mode: next });
      if (next === "LIVE") await outbox.discardPractice();
      await forgetLocalState();
      const current = sessionStore.get();
      if (current) sessionStore.set({ ...current, session: { ...current.session, mode: next, shiftId: null } });
      await qc.invalidateQueries();
      toast.success(next === "PRACTICE" ? t("practice.entered") : t("practice.left"));
      return true;
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
      return false;
    }
  };

  return { mode, isPractice: mode === "PRACTICE", switchTo };
}
