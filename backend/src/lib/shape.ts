/**
 * Response shaping — the single place field-level authorization happens. PRD §16.5,
 * §15.1, §23.1 item 2.
 *
 * Every route returns data through a function in this file, never a raw ORM object. Cost,
 * margin and supplier terms appear only for the OWNER — a manager runs the shop without them
 * (§16.4). A route test sweeps every endpoint with an employee token and again with a manager's,
 * and asserts none of COST_KEYS ever appears (§27.9).
 */
import { isManager, isOwner, parsePermissions, type Role } from "@simon/shared";

/** Keys only the owner's token may receive, anywhere in a response body. */
export const COST_KEYS = ["avgCostMdram", "unitCostMdram", "marginDram", "cogs", "paymentTerms", "landedUnitCostMdram", "costDram"] as const;

/** Cost is the owner's alone (§16.5). Named for the question, so a call site reads as its rule. */
export const seesCost = (role: Role) => isOwner(role);
export { isManager, isOwner };

export const bool = (v: number) => v === 1;

/**
 * `avatarUpdatedAt` says whether there is a photograph and what to cache-bust on; the bytes never
 * travel in JSON (§15.4).
 *
 * `phone`, `startedOn` and `note` are personal details (§6.17, §19.6), reached only from the
 * owner-and-manager block of §15.4. **A manager sees an employee's, their own, and nobody
 * else's**: the owner's record is the owner's, and a manager's is not another manager's business.
 * So the viewer is part of the shape, and a row outside what they may read keeps its name, role
 * and state and loses the rest.
 */
export function shapeUser(
  u: { id: string; name: string; role: string; permissions?: string; isActive: number; failedAttempts: number; lockedUntil: string | null; createdAt: string; avatarUpdatedAt?: string | null; phone?: string | null; startedOn?: string | null; note?: string | null },
  viewer: { id: string; role: Role },
) {
  const personal = isOwner(viewer.role) || u.role === "EMPLOYEE" || u.id === viewer.id;
  return {
    id: u.id, name: u.name, role: u.role, permissions: parsePermissions(u.permissions),
    isActive: bool(u.isActive), lockedUntil: u.lockedUntil, createdAt: u.createdAt, avatarUpdatedAt: u.avatarUpdatedAt ?? null,
    phone: personal ? u.phone ?? null : null, startedOn: personal ? u.startedOn ?? null : null, note: personal ? u.note ?? null : null,
  };
}

export function shapeSession(s: { id: string; userId: string; deviceId: string; mode: string; shiftId: string | null; createdAt: string; lastSeenAt: string; expiresAt: string; revokedAt: string | null; user?: { name: string }; device?: { label: string; prefix: string } }) {
  return {
    id: s.id, userId: s.userId, userName: s.user?.name ?? null, deviceId: s.deviceId,
    deviceLabel: s.device?.label ?? null, devicePrefix: s.device?.prefix ?? null,
    mode: s.mode, shiftId: s.shiftId, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt,
  };
}

export function shapeDevice(d: { id: string; prefix: string; label: string; registeredAt: string; lastSequence: number; outboxDepth: number; outboxOldestAt: string | null; parkedDepth: number; lastSeenAt: string | null; isActive: number }) {
  return { ...d, isActive: bool(d.isActive) };
}

/** Recursively removes cost keys — a backstop for composite report rows, not a substitute for shaping. */
export function stripCost<T>(value: T, role: Role): T {
  if (seesCost(role)) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).filter(([k]) => !(COST_KEYS as readonly string[]).includes(k)).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

type ProductRow = {
  id: string; sku: string | null; name: string; categoryId: string | null; stockUom: string; stockQty: number; decimalPlaces: number;
  avgCostMdram: number | null; sellPriceMdram: number; taxCategory: string; reorderPoint: number; reorderQty: number;
  tilePinnedAt: string | null; trackStock: number; isActive: number; updatedAt: string; nameSearch: string;
  barcodes?: { barcode: string; isPrimary: number; retiredAt: string | null }[];
  units?: { id: string; uom: string; factorToStockUom: number; role: string }[];
  stats?: { avgDailyQty30d: number; daysSinceLastSale: number | null } | null;
};

export function shapeProduct(p: ProductRow, role: Role) {
  const base = {
    id: p.id, sku: p.sku, name: p.name, nameSearch: p.nameSearch, categoryId: p.categoryId, stockUom: p.stockUom, stockQty: p.stockQty,
    decimalPlaces: p.decimalPlaces, sellPriceMdram: p.sellPriceMdram, taxCategory: p.taxCategory,
    reorderPoint: p.reorderPoint, reorderQty: p.reorderQty, tilePinnedAt: p.tilePinnedAt, trackStock: bool(p.trackStock),
    isActive: bool(p.isActive), updatedAt: p.updatedAt,
    barcodes: (p.barcodes ?? []).map((b) => ({ barcode: b.barcode, isPrimary: bool(b.isPrimary), retiredAt: b.retiredAt })),
    units: (p.units ?? []).map((u) => ({ id: u.id, uom: u.uom, factorToStockUom: u.factorToStockUom, role: u.role })),
    velocity: p.stats?.avgDailyQty30d ?? 0,
  };
  if (!seesCost(role)) return base;
  return { ...base, avgCostMdram: p.avgCostMdram, needsDetail: { cost: p.avgCostMdram === null, category: p.categoryId === null, barcode: (p.barcodes ?? []).length === 0 } };
}

type SaleRow = {
  id: string; number: string | null; shiftId: string; userId: string; customerId: string | null; status: string; subtotal: number;
  discountTotal: number; discountReason: string | null; taxTotal: number; priceBasis: string; roundingAdjustment: number; total: number;
  businessDate: string; createdAt: string; completedAt: string | null;
  user?: { name: string };
  lines?: { id: string; productId: string; productName: string; qty: number; uom: string; factorToStockUom: number; unitPriceMdram: number; unitCostMdram: number | null; taxRateBp: number; lineTax: number; discountAmount: number; discountReason: string | null; priceOverridden: number; lineTotal: number }[];
  payments?: { id: string; method: string; amount: number; tenderedAmount: number | null; changeGiven: number | null }[];
};

export function shapeSale(s: SaleRow, role: Role) {
  return {
    id: s.id, number: s.number, shiftId: s.shiftId, userId: s.userId, userName: s.user?.name ?? null, customerId: s.customerId, status: s.status,
    subtotal: s.subtotal, discountTotal: s.discountTotal, discountReason: s.discountReason, taxTotal: s.taxTotal, priceBasis: s.priceBasis,
    roundingAdjustment: s.roundingAdjustment, total: s.total, businessDate: s.businessDate, createdAt: s.createdAt, completedAt: s.completedAt,
    lines: (s.lines ?? []).map((l) => {
      const line = {
        id: l.id, productId: l.productId, productName: l.productName, qty: l.qty, uom: l.uom, factorToStockUom: l.factorToStockUom,
        unitPriceMdram: l.unitPriceMdram, taxRateBp: l.taxRateBp, lineTax: l.lineTax, discountAmount: l.discountAmount,
        discountReason: l.discountReason, priceOverridden: bool(l.priceOverridden), lineTotal: l.lineTotal,
      };
      return seesCost(role) ? { ...line, unitCostMdram: l.unitCostMdram } : line;
    }),
    payments: (s.payments ?? []).map((p) => ({ id: p.id, method: p.method, amount: p.amount, tenderedAmount: p.tenderedAmount, changeGiven: p.changeGiven })),
  };
}

export function shapeMovement(m: { id: string; seq: number; type: string; qtyDelta: number; unitCostMdram: number | null; balanceAfter: number; sourceType: string; sourceId: string; reasonCode: string | null; note: string; createdAt: string; user?: { name: string } }, role: Role) {
  const base = { id: m.id, seq: m.seq, type: m.type, qtyDelta: m.qtyDelta, balanceAfter: m.balanceAfter, sourceType: m.sourceType, sourceId: m.sourceId, reasonCode: m.reasonCode, note: m.note, createdAt: m.createdAt, userName: m.user?.name ?? null };
  return seesCost(role) ? { ...base, unitCostMdram: m.unitCostMdram } : base;
}

type CustomerRow = { id: string; fullName: string | null; nameSearch: string; phone: string | null; discountBp: number; creditLimit: number; isBlocked: number; isActive: number; mergedIntoId: string | null; anonymisedAt: string | null; notes: string; updatedAt: string };

/** A worker sees who owes what and the limit on the debt sale screen; the discount and notes are the owner's (§6.15). */
export function shapeCustomer(c: CustomerRow, role: Role, figures?: { outstanding: number; oldestChargeDays: number | null; overdue: number; lastSaleAt?: string | null }) {
  const base = {
    id: c.id, fullName: c.fullName, nameSearch: c.nameSearch, phone: c.phone, creditLimit: c.creditLimit, isBlocked: bool(c.isBlocked),
    isActive: bool(c.isActive), mergedIntoId: c.mergedIntoId, anonymised: c.anonymisedAt !== null, updatedAt: c.updatedAt,
    ...(figures ? { outstanding: figures.outstanding, oldestChargeDays: figures.oldestChargeDays, overdue: figures.overdue, lastSaleAt: figures.lastSaleAt ?? null } : {}),
  };
  return isManager(role) ? { ...base, discountBp: c.discountBp, notes: c.notes } : base;
}

type FlagRow = {
  id: string; type: string; sourceType: string; sourceId: string; productId: string | null; customerId: string | null;
  note: string; createdAt: string; resolvedAt: string | null; resolvedBy: string | null;
};

/** Costs reach a flag's note as JSON, which no field-by-field rule would have looked inside (§16.5). */
const COST_NOTE_KEY = /cost|mdram|margin/i;

export function shapeFlag(f: FlagRow, role: Role, labels: { productName?: string | null; customerName?: string | null; sourceLabel?: string | null } = {}) {
  let note: unknown = f.note;
  try { note = f.note ? JSON.parse(f.note) : null; } catch { note = f.note; }
  if (!seesCost(role) && note && typeof note === "object" && !Array.isArray(note)) {
    note = Object.fromEntries(Object.entries(note as Record<string, unknown>).filter(([k]) => !COST_NOTE_KEY.test(k)));
  }
  return {
    id: f.id, type: f.type, sourceType: f.sourceType, sourceId: f.sourceId,
    productId: f.productId, productName: labels.productName ?? null,
    customerId: f.customerId, customerName: labels.customerName ?? null,
    sourceLabel: labels.sourceLabel ?? null,
    note, createdAt: f.createdAt, resolvedAt: f.resolvedAt,
  };
}
