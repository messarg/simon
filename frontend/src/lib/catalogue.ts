/**
 * The catalogue cache. PRD §14.4, §6.1.
 *
 * Products (with every barcode and unit) live in IndexedDB so a worker can scan, search and
 * build a basket with the server unreachable. Sync is incremental by `updatedAt`. Lookups are
 * local-first — the scan budget is 200 ms and the network is not part of it.
 */
import { useSyncExternalStore } from "react";
import { matchesSearch } from "@simon/shared";
import { connection } from "./connection.ts";
import { http } from "./http.ts";
import { getMeta, localDb, setMeta, type CachedProduct } from "./local-db.ts";

export interface ApiProduct {
  id: string; name: string; nameSearch: string; stockUom: string; decimalPlaces: number; sellPriceMdram: number; stockQty: number;
  isActive: boolean; tilePinnedAt: string | null; categoryId: string | null; trackStock: boolean; updatedAt: string; velocity: number;
  barcodes: { barcode: string; isPrimary: boolean; retiredAt: string | null }[];
  units: { id: string; uom: string; factorToStockUom: number; role: string }[];
  sku?: string | null; reorderPoint?: number; reorderQty?: number; avgCostMdram?: number | null;
  needsDetail?: { cost: boolean; category: boolean; barcode: boolean };
}

export function toCached(p: ApiProduct): CachedProduct {
  return {
    id: p.id, name: p.name, nameSearch: p.nameSearch, stockUom: p.stockUom, decimalPlaces: p.decimalPlaces, sellPriceMdram: p.sellPriceMdram,
    stockQty: p.stockQty, isActive: p.isActive, tilePinnedAt: p.tilePinnedAt, categoryId: p.categoryId, trackStock: p.trackStock,
    barcodes: p.barcodes.map((b) => b.barcode), units: p.units.map((u) => ({ uom: u.uom, factorToStockUom: u.factorToStockUom, role: u.role })),
    velocity: p.velocity, updatedAt: p.updatedAt,
  };
}

let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version++; listeners.forEach((l) => l()); };
export const useCatalogueVersion = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);

export async function putProducts(products: ApiProduct[]) {
  if (!products.length) return;
  const db = await localDb();
  const tx = db.transaction("catalogue", "readwrite");
  await Promise.all(products.map((p) => tx.store.put(toCached(p))));
  await tx.done;
  bump();
}

export async function syncCatalogue() {
  const since = await getMeta<string>("catalogue.since");
  const res = await http.get<{ serverTime: string; products: ApiProduct[] }>("/catalogue/snapshot", { query: { since }, timeoutMs: 15_000 });
  await putProducts(res.products);
  await setMeta("catalogue.since", res.serverTime);
  await setMeta("catalogue.syncedAt", new Date().toISOString());
  connection.reportSuccess();
  return res.products.length;
}

/** Drops the cache and its sync marker, so the next sync rebuilds it from whichever database is now current (§19.4). */
export async function clearCatalogue() {
  const db = await localDb();
  await db.clear("catalogue");
  await setMeta("catalogue.since", undefined);
  await setMeta("catalogue.syncedAt", undefined);
  bump();
}

export async function findByBarcode(code: string): Promise<CachedProduct | null> {
  const db = await localDb();
  const local = await db.getFromIndex("catalogue", "byBarcode", code);
  if (local) return local;
  if (connection.get() === "offline") return null;
  try {
    const p = await http.get<ApiProduct>(`/products/by-barcode/${encodeURIComponent(code)}`, { timeoutMs: 1500 });
    await putProducts([p]);
    return toCached(p);
  } catch {
    return null;
  }
}

export async function getCachedProduct(id: string) {
  return (await localDb()).get("catalogue", id);
}

export async function searchCatalogue(query: string, limit = 30): Promise<CachedProduct[]> {
  const q = query.trim();
  if (!q) return [];
  const all = await (await localDb()).getAll("catalogue");
  return all.filter((p) => p.isActive && (matchesSearch(p.nameSearch, q) || p.barcodes.includes(q))).slice(0, limit);
}

/** Pinned first by pin time, then sales velocity fills the rest (§6.1). */
export async function quickTiles(limit = 12): Promise<CachedProduct[]> {
  const all = (await (await localDb()).getAll("catalogue")).filter((p) => p.isActive);
  const pinned = all.filter((p) => p.tilePinnedAt).sort((a, b) => a.tilePinnedAt!.localeCompare(b.tilePinnedAt!));
  const rest = all.filter((p) => !p.tilePinnedAt && p.velocity > 0).sort((a, b) => b.velocity - a.velocity);
  const tiles = [...pinned, ...rest];
  // A brand-new shop has no velocity yet: show unbarcoded goods so there is something to tap.
  if (tiles.length < limit) tiles.push(...all.filter((p) => !p.tilePinnedAt && p.velocity === 0 && p.barcodes.length === 0).slice(0, limit - tiles.length));
  return tiles.slice(0, limit);
}

/** Optimistic, last-known: the server's figure replaces it on the next sync (§14.4). */
export async function adjustCachedStock(deltas: Array<{ productId: string; delta: number }>) {
  const db = await localDb();
  for (const d of deltas) {
    const p = await db.get("catalogue", d.productId);
    if (p) await db.put("catalogue", { ...p, stockQty: p.stockQty + d.delta });
  }
  bump();
}
