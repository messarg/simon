/**
 * The customer cache. PRD §14.4, §6.3, §6.15.
 *
 * Names, last-known balances, limits and the block flag, so a debt sale can be refused at the
 * counter and a debtor found with the server unreachable. Balances are last known and every
 * screen that shows one offline says so.
 */
import { useSyncExternalStore } from "react";
import { matchesSearch, type SaleBody } from "@simon/shared";
import { connection } from "./connection.ts";
import { http } from "./http.ts";
import { getMeta, localDb, setMeta, type CachedCustomer } from "./local-db.ts";
import { outbox } from "./outbox.ts";

let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version++; listeners.forEach((l) => l()); };
export const useCustomerVersion = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);

export async function putCustomers(rows: CachedCustomer[]) {
  if (!rows.length) return;
  const db = await localDb();
  const tx = db.transaction("customers", "readwrite");
  await Promise.all(rows.map((c) => tx.store.put(c)));
  await tx.done;
  bump();
}

export async function syncCustomers() {
  const since = await getMeta<string>("customers.since");
  const res = await http.get<{ serverTime: string; customers: CachedCustomer[] }>("/customers/snapshot", { query: { since }, timeoutMs: 15_000 });
  await putCustomers(res.customers);
  await setMeta("customers.since", res.serverTime);
  connection.reportSuccess();
}

export async function getCachedCustomer(id: string) {
  return (await localDb()).get("customers", id);
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Debtors first, then the most recent buyers, then everyone; search by Latin-typed name or phone digits. */
export async function searchCustomers(query: string, limit = 40): Promise<CachedCustomer[]> {
  const all = (await (await localDb()).getAll("customers")).filter((c) => c.isActive && !c.anonymised);
  const q = query.trim();
  const d = digits(q);
  const hits = q ? all.filter((c) => matchesSearch(c.nameSearch, q) || (d.length >= 3 && (c.phone ?? "").includes(d))) : all;
  return hits.sort((a, b) => b.outstanding - a.outstanding || (b.lastSaleAt ?? "").localeCompare(a.lastSaleAt ?? "") || (a.fullName ?? "").localeCompare(b.fullName ?? "")).slice(0, limit);
}

/** Debt already queued on this till for a customer during this outage — the offline cap's running total (§14.5). */
export function queuedDebtFor(customerId: string) {
  return outbox.items()
    .filter((i) => i.kind === "sale" && i.state !== "parked" && !i.isParkedBasket)
    .map((i) => i.body as SaleBody)
    .filter((b) => b.customerId === customerId)
    .reduce((a, b) => a + b.payments.filter((p) => p.method === "DEBT").reduce((x, p) => x + p.amount, 0), 0);
}

/** Last-known, adjusted optimistically; the next sync replaces it (§14.4). */
export async function adjustCachedBalance(customerId: string, delta: number) {
  const c = await getCachedCustomer(customerId);
  if (c) await putCustomers([{ ...c, outstanding: c.outstanding + delta }]);
}
