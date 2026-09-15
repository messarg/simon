/**
 * Request bodies shared by server validation and client construction. PRD §15.3–15.4.
 * Money and quantity are integers on the wire — a decimal is a 400, never coerced (§15.1).
 */
import { z } from "zod";
import { CashReasonCode, PriceBasis, Role, WriteOffReason } from "./enums.ts";

const id = z.string().uuid();
const int = z.number().int();
const nonNeg = int.min(0);
const pos = int.min(1);
const iso = z.string().datetime({ offset: true });
const text = (max: number) => z.string().trim().max(max);

export const SaleLineBody = z.object({
  id,
  productId: id,
  qty: pos,
  uom: text(16).min(1),
  factorToStockUom: pos,
  unitPriceMdram: nonNeg,
  taxRateBp: int.min(0).max(10_000),
  discountAmount: nonNeg,
  discountReason: text(120).nullish(),
  priceOverridden: z.boolean(),
  /** The till's figure, compared and never trusted (§15.3). */
  lineTotal: nonNeg,
});

export const PaymentBody = z.object({
  id,
  method: z.enum(["CASH", "CARD", "DEBT"]),
  amount: pos,
  tenderedAmount: pos.nullish(),
});

export const SaleBody = z.object({
  id,
  status: z.enum(["HELD", "COMPLETED"]),
  shiftId: id,
  number: z.string().regex(/^[A-Z0-9]{2}-\d{1,9}$/).nullish(),
  customerId: id.nullish(),
  priceBasis: PriceBasis,
  cashRoundingStep: pos,
  saleDiscount: nonNeg,
  discountReason: text(120).nullish(),
  lines: z.array(SaleLineBody).min(1).max(500),
  payments: z.array(PaymentBody).max(10),
  total: int,
  createdAt: iso,
  /** Device clock at the moment of sending, for the skew check (§11 `DEVICE_CLOCK_SKEW`). */
  sentAt: iso,
  /** Drained from the outbox rather than sent at the counter (§15.3's two bargains). */
  queued: z.boolean(),
  reauthGrant: z.string().nullish(),
  overrideReason: text(240).nullish(),
});
export type SaleBody = z.infer<typeof SaleBody>;
export type SaleLineBody = z.infer<typeof SaleLineBody>;

export const SaleReturnBody = z.object({
  id,
  originalSaleId: id.nullable(),
  shiftId: id,
  reason: text(240).min(1),
  lines: z.array(z.object({
    id,
    saleLineId: id.nullable(),
    /** Blind returns only (admin): what comes back and what it refunds. */
    productId: id.nullish(),
    refundAmount: nonNeg.nullish(),
    qty: pos,
    restock: z.boolean(),
    writeOffReason: WriteOffReason.nullish(),
  })).min(1).max(500),
  createdAt: iso,
  sentAt: iso,
  queued: z.boolean(),
  reauthGrant: z.string().nullish(),
});
export type SaleReturnBody = z.infer<typeof SaleReturnBody>;

export const CashMovementBody = z.object({
  id,
  shiftId: id,
  type: z.enum(["PAY_IN", "PAY_OUT", "DROP"]),
  amount: pos,
  reasonCode: CashReasonCode.nullish(),
  reason: text(240).min(1),
  createdAt: iso,
  queued: z.boolean(),
});
export type CashMovementBody = z.infer<typeof CashMovementBody>;

export const OpenShiftBody = z.object({ id, openingFloat: nonNeg });
export const BeginCloseBody = z.object({ unsyncedAtClose: nonNeg.max(100_000) });
export const CloseShiftBody = z.object({
  breakdown: z.array(z.object({ value: pos, count: nonNeg })).max(20),
  note: text(500).optional(),
  unsyncedAtClose: nonNeg.max(100_000),
});

export const ProductUnitBody = z.object({ uom: text(16).min(1), factorToStockUom: pos, role: z.enum(["PURCHASE", "SALE"]) });

export const CreateProductBody = z.object({
  id,
  name: text(120).min(1),
  sellPriceMdram: nonNeg,
  stockUom: text(16).min(1),
  decimalPlaces: int.min(0).max(3),
  barcode: z.string().regex(/^[0-9A-Za-z-]{1,48}$/).nullish(),
  sku: text(40).nullish(),
  categoryId: id.nullish(),
  reorderPoint: nonNeg.optional(),
  reorderQty: nonNeg.optional(),
  trackStock: z.boolean().optional(),
});
export type CreateProductBody = z.infer<typeof CreateProductBody>;

export const UpdateProductBody = z.object({
  name: text(120).min(1).optional(),
  sellPriceMdram: nonNeg.optional(),
  stockUom: text(16).min(1).optional(),
  decimalPlaces: int.min(0).max(3).optional(),
  sku: text(40).nullish(),
  categoryId: id.nullish(),
  reorderPoint: nonNeg.optional(),
  reorderQty: nonNeg.optional(),
  trackStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
  pinnedTile: z.boolean().optional(),
  reauthGrant: z.string().nullish(),
});

export const UserBody = z.object({ name: text(60).min(1), pin: z.string(), role: Role });
