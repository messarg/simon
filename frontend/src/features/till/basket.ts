/**
 * The basket in progress. PRD §6.1, §12.1.
 *
 * Its id is the sale's id, generated when the first line is added, so parking and completing
 * are two posts of one document (§14.3). It persists to IndexedDB on every change: navigating
 * away, locking the phone or signing in again never loses it.
 */
import { useSyncExternalStore } from "react";
import { computeSale, effectiveLineDiscount, lineTotal, uuidv7, type ClientSettings, type MilliDram, type MilliUnit } from "@simon/shared";
import { localDb } from "@/lib/local-db.ts";
import type { CachedProduct } from "@/lib/local-db.ts";

export interface BasketLine {
  id: string;
  productId: string;
  name: string;
  uom: string;
  factorToStockUom: number;
  decimalPlaces: number;
  catalogueMdram: MilliDram;
  unitPriceMdram: MilliDram;
  taxRateBp: number;
  qty: MilliUnit;
  discountAmount: number;
  priceOverridden: boolean;
  trackStock: boolean;
  stockQty: number;
}

export interface Basket {
  id: string;
  createdAt: string;
  lines: BasketLine[];
  saleDiscount: number;
  discountReason: string | null;
  /** A grant from admin re-auth covering this basket's discount, and the reason typed. */
  reauthGrant: string | null;
  overrideReason: string | null;
  /** Set when resumed from a basket the server holds — completing it is a transition. */
  resumedShiftId: string | null;
}

const empty = (): Basket => ({ id: uuidv7(), createdAt: new Date().toISOString(), lines: [], saleDiscount: 0, discountReason: null, reauthGrant: null, overrideReason: null, resumedShiftId: null });

let state: Basket = empty();
let loaded = false;
const listeners = new Set<() => void>();

function commit(next: Basket) {
  state = next;
  listeners.forEach((l) => l());
  void localDb().then((db) => db.put("basket", state, "current"));
}

export const basketStore = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  async load() {
    if (loaded) return;
    loaded = true;
    const saved = (await (await localDb()).get("basket", "current")) as Basket | undefined;
    if (saved?.lines) { state = saved; listeners.forEach((l) => l()); }
  },
  /** Adds one unit, or increments the existing line and moves it to the top (§6.1: never a duplicate). */
  add(p: CachedProduct, taxRateBp: number, qty: MilliUnit = 1000) {
    const existing = state.lines.find((l) => l.productId === p.id && l.factorToStockUom === 1);
    const base = state.lines.length === 0 ? { ...empty(), id: state.id, createdAt: new Date().toISOString(), resumedShiftId: state.resumedShiftId } : state;
    if (existing) {
      const updated = { ...existing, qty: existing.qty + qty };
      commit({ ...base, lines: [updated, ...base.lines.filter((l) => l.id !== existing.id)] });
      return updated;
    }
    const line: BasketLine = {
      id: uuidv7(), productId: p.id, name: p.name, uom: p.stockUom, factorToStockUom: 1, decimalPlaces: p.decimalPlaces,
      catalogueMdram: p.sellPriceMdram, unitPriceMdram: p.sellPriceMdram, taxRateBp, qty, discountAmount: 0, priceOverridden: false,
      trackStock: p.trackStock, stockQty: p.stockQty,
    };
    commit({ ...base, lines: [line, ...base.lines] });
    return line;
  },
  setQty(lineId: string, qty: MilliUnit) { commit({ ...state, lines: state.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)) }); },
  setPrice(lineId: string, unitPriceMdram: MilliDram) {
    commit({ ...state, lines: state.lines.map((l) => (l.id === lineId ? { ...l, unitPriceMdram, priceOverridden: unitPriceMdram !== l.catalogueMdram } : l)) });
  },
  remove(lineId: string): { line: BasketLine; index: number } | null {
    const index = state.lines.findIndex((l) => l.id === lineId);
    if (index < 0) return null;
    const line = state.lines[index];
    commit({ ...state, lines: state.lines.filter((l) => l.id !== lineId) });
    return { line, index };
  },
  restore(line: BasketLine, index: number) {
    const lines = [...state.lines];
    lines.splice(Math.min(index, lines.length), 0, line);
    commit({ ...state, lines });
  },
  setDiscount(amount: number, reason: string | null) { commit({ ...state, saleDiscount: amount, discountReason: reason }); },
  setGrant(grant: string | null, reason: string | null) { commit({ ...state, reauthGrant: grant, overrideReason: reason ?? state.overrideReason }); },
  setOverrideReason(reason: string) { commit({ ...state, overrideReason: reason }); },
  replace(next: Basket) { commit(next); },
  clear() { commit(empty()); },
};

export function useBasket() {
  return useSyncExternalStore(basketStore.subscribe, basketStore.get);
}

export function taxRateFor(settings: ClientSettings) {
  return settings.taxRegime === "VAT" ? settings.taxRateBp : 0;
}

export function basketTotals(basket: Basket, settings: ClientSettings) {
  const lines = basket.lines.map((l) => ({ qty: l.qty, unitPriceMdram: l.unitPriceMdram, taxRateBp: l.taxRateBp, discountAmount: l.discountAmount }));
  const subtotal = lines.reduce((a, l) => a + lineTotal(l.qty, l.unitPriceMdram) - l.discountAmount, 0);
  const saleDiscount = Math.min(basket.saleDiscount, subtotal);
  return computeSale(lines, saleDiscount, settings.priceBasis, settings.cashRoundingStep);
}

/** The cap as one control over discounts and price overrides (§12.1), checked at the counter. */
export function discountState(basket: Basket, settings: ClientSettings) {
  let base = 0;
  let discount = basket.saleDiscount;
  for (const l of basket.lines) {
    base += lineTotal(l.qty, l.catalogueMdram);
    discount += effectiveLineDiscount(l.qty, l.catalogueMdram, l);
  }
  const over = (bp: number) => discount > 0 && discount * 10_000 > base * bp;
  return { discount, base, aboveCap: over(settings.maxDiscountBp), aboveCeiling: over(Math.max(settings.offlineDiscountCeilingBp, settings.maxDiscountBp)) };
}
