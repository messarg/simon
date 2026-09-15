/** Per-session background work: the outbox drain and heartbeat, catalogue sync, and releasing held items after a sign-in. */
import { useEffect } from "react";
import { basketStore } from "@/features/till/basket.ts";
import { syncCatalogue } from "@/lib/catalogue.ts";
import { syncCustomers } from "@/lib/customers.ts";
import { connection } from "@/lib/connection.ts";
import { outbox, startOutbox } from "@/lib/outbox.ts";
import { useSession } from "@/lib/session-store.ts";

export function Bootstrap() {
  const session = useSession();
  const sessionId = session?.session.id;
  useEffect(() => {
    if (!sessionId) return;
    void basketStore.load();
    void outbox.releaseHeld();
    const stop = startOutbox();
    const sync = () => {
      if (connection.get() !== "online") return;
      syncCatalogue().catch(() => {});
      syncCustomers().catch(() => {});
    };
    // Balances change with every sale and repayment on any till, so accepted documents refresh the cache.
    const unsubResult = outbox.onResult((item) => { if (item.kind === "sale" || item.kind === "debt-payment" || item.kind === "sale-return") syncCustomers().catch(() => {}); });
    sync();
    const id = setInterval(sync, 60_000);
    const unsub = connection.subscribe(sync);
    return () => { stop(); clearInterval(id); unsub(); unsubResult(); };
  }, [sessionId]);
  return null;
}
