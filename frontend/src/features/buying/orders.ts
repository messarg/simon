/** Purchase order shapes as the API returns them (§11). Costs are present for the owner only. */
export type OrderStatus = "DRAFT" | "OPEN" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export interface OrderLine {
  id: string; productId: string; productName: string; sku: string | null; barcode: string | null;
  stockUom: string; decimalPlaces: number; uom: string; factorToStockUom: number;
  /** Stock milli-units. */
  qtyOrdered: number; qtyReceived: number;
  /** Per unit ordered; absent for STOCK. */
  unitCostMdram?: number;
}

export interface Order {
  id: string; number: string; status: OrderStatus; supplierId: string; supplierName: string; supplierPhone: string | null;
  expectedAt: string | null; note: string; createdAt: string; openedAt: string | null; cancelledAt: string | null;
  receipts: Array<{ id: string; number: string; receivedAt: string }>;
  lines: OrderLine[];
  total?: number;
}

export interface OrderRow { id: string; number: string; status: OrderStatus; supplierId: string; supplierName: string; expectedAt: string | null; createdAt: string; lines: number; total?: number }

/** An ordered quantity in the unit it was ordered in: 100 m ordered as 50 m spools is 2. */
export const inOrderedUnit = (stockMilli: number, factor: number) => stockMilli / factor;

export const statusTone = (s: OrderStatus) =>
  s === "DRAFT" ? "bg-muted text-muted-foreground" : s === "OPEN" || s === "PARTIAL" ? "bg-primary-soft text-accent-foreground" : s === "CANCELLED" ? "bg-muted text-muted-foreground line-through" : "bg-success-soft text-success";

