/** Per-session background work: the outbox drain and heartbeat, catalogue sync, and releasing held items after a sign-in. */
import { useEffect } from "react";
import { basketStore } from "@/features/till/basket.ts";
import { syncCatalogue } from "@/lib/catalogue.ts";
import { can } from "@simon/shared";
import { clearCustomers, syncCustomers } from "@/lib/customers.ts";
import { connection } from "@/lib/connection.ts";
import { outbox, startOutbox } from "@/lib/outbox.ts";
import { useSession } from "@/lib/session-store.ts";

export function Bootstrap() {
  const session = useSession();
  const sessionId = session?.session.id;
  // The debt book is a job of its own (§16.4): who owes what is not cached on a device for someone
  // who may not read it — and a cache another person left behind is cleared rather than inherited.
  const keepsDebtBook = !!session && can(session.user, "debt");
  useEffect(() => {
    if (!sessionId) return;
    if (!keepsDebtBook) void clearCustomers();
    void basketStore.load();
    void outbox.releaseHeld();
    const stop = startOutbox();
    const sync = () => {
      if (connection.get() !== "online") return;
      syncCatalogue().catch(() => {});
      if (keepsDebtBook) syncCustomers().catch(() => {});
    };
    // Balances change with every sale and repayment on any till, so accepted documents refresh the cache.
    const unsubResult = outbox.onResult((item) => { if (keepsDebtBook && (item.kind === "sale" || item.kind === "debt-payment" || item.kind === "sale-return")) syncCustomers().catch(() => {}); });
    sync();
    const id = setInterval(sync, 60_000);
    const unsub = connection.subscribe(sync);
    return () => { stop(); clearInterval(id); unsub(); unsubResult(); };
  }, [sessionId, keepsDebtBook]);
  return null;
}
