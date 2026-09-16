/**
 * IndexedDB. PRD §14.4.
 *
 *   catalogue  products (with barcodes and units), keyed by id, for offline scan and search
 *   settings   the client settings shape, one row
 *   outbox     queue-drained documents awaiting delivery, FIFO by `enqueuedAt`
 *   basket     the basket in progress, so it survives navigation and restart (§6.1)
 *   meta       lastSyncAt, device sequence counter
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface CachedProduct {
  id: string;
  name: string;
  nameSearch: string;
  stockUom: string;
  decimalPlaces: number;
  sellPriceMdram: number;
  stockQty: number;
  isActive: boolean;
  tilePinnedAt: string | null;
  categoryId: string | null;
  trackStock: boolean;
  /** Every code, retired ones included — an old sticker still scans (§11). */
  barcodes: string[];
  units: { uom: string; factorToStockUom: number; role: string }[];
  velocity: number;
  updatedAt: string;
}

export interface CachedCustomer {
  id: string;
  fullName: string | null;
  nameSearch: string;
  phone: string | null;
  outstanding: number;
  oldestChargeDays: number | null;
  overdue: number;
  creditLimit: number;
  isBlocked: boolean;
  isActive: boolean;
  anonymised: boolean;
  lastSaleAt: string | null;
  updatedAt: string;
}

export type OutboxKind = "sale" | "sale-return" | "cash-movement" | "debt-payment";
export type OutboxState = "pending" | "held" | "parked";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  body: unknown;
  /** Which database this document belongs to. A practice document is discarded, never sent (§19.4). */
  mode?: "LIVE" | "PRACTICE";
  /** Documents this one depends on, which must drain first (§14.4). */
  dependsOn: string[];
  enqueuedAt: string;
  attempts: number;
  state: OutboxState;
  lastError: { status: number; type: string } | null;
  nextAttemptAt: number;
  /** Enqueued with the server unreachable: the counter's checks were the till's alone (§15.3). */
  enqueuedOffline: boolean;
  /** Host-owned follow-ups, only for documents completed while the host was reachable (§14.5). */
  afterSync: { print: boolean; drawer: boolean } | null;
  /** Short label for the needs-attention list. */
  label: string;
  /** Counted apart from sales in transit (§11 `Device.parkedDepth`). */
  isParkedBasket: boolean;
  requeuedOnce: boolean;
}

interface SimonDB extends DBSchema {
  catalogue: { key: string; value: CachedProduct; indexes: { byBarcode: string } };
  customers: { key: string; value: CachedCustomer };
  settings: { key: string; value: unknown };
  outbox: { key: string; value: OutboxItem; indexes: { byEnqueuedAt: string } };
  basket: { key: string; value: unknown };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<SimonDB>> | null = null;

export function localDb() {
  dbPromise ??= openDB<SimonDB>("simon", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const catalogue = db.createObjectStore("catalogue", { keyPath: "id" });
        catalogue.createIndex("byBarcode", "barcodes", { multiEntry: true });
        db.createObjectStore("settings");
        db.createObjectStore("outbox", { keyPath: "id" }).createIndex("byEnqueuedAt", "enqueuedAt");
        db.createObjectStore("basket");
        db.createObjectStore("meta");
      }
      // v2 — Phase 2: customers, names and last-known balances for the debt sale screen (§14.4).
      if (oldVersion < 2) db.createObjectStore("customers", { keyPath: "id" });
    },
  });
  return dbPromise;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await localDb()).get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await (await localDb()).put("meta", value, key);
}
