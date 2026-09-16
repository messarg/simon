/**
 * Request bodies shared by server validation and client construction. PRD §15.3–15.4.
 * Money and quantity are integers on the wire — a decimal is a 400, never coerced (§15.1).
 */
import { z } from "zod";
import { CashReasonCode, ImportKind, PriceBasis, Role, WriteOffReason } from "./enums.ts";

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
  /** Debt sale (§12.2): an optional promised date — it never moves aging (§10.6). */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  /** Admin re-auth for going over the customer's credit limit, and the reason typed (§6.3). */
  limitGrant: z.string().nullish(),
  limitReason: text(240).nullish(),
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

export const DebtPaymentBody = z.object({
  id,
  customerId: id,
  amount: pos,
  method: z.enum(["CASH", "CARD"]),
  /** Required for cash: the drawer it went into (§12.3). */
  shiftId: id.nullish(),
  /** A person's choice of which charges this settles; otherwise oldest-first (§10.6). */
  allocations: z.array(z.object({ chargeEntryId: id, amount: pos })).max(200).optional(),
  createdAt: iso,
  queued: z.boolean(),
});
export type DebtPaymentBody = z.infer<typeof DebtPaymentBody>;

export const ReverseDebtPaymentBody = z.object({
  reauthGrant: z.string().min(1),
  reason: text(240).min(1),
  /** Re-enter the same money against the right customer, in the same act (§8.2). */
  reenterCustomerId: id.nullish(),
});

export const CreateCustomerBody = z.object({
  id,
  fullName: text(120).min(1),
  phone: z.string().trim().max(32).nullish(),
});
export type CreateCustomerBody = z.infer<typeof CreateCustomerBody>;

export const UpdateCustomerBody = z.object({
  fullName: text(120).min(1).optional(),
  phone: z.string().trim().max(32).nullish(),
  creditLimit: nonNeg.optional(),
  isBlocked: z.boolean().optional(),
  discountBp: int.min(0).max(10_000).optional(),
  notes: text(1000).optional(),
  isActive: z.boolean().optional(),
});

export const ReverseCashMovementBody = z.object({ reason: text(240).min(1) });

export const SupplierBody = z.object({
  id,
  name: text(120).min(1),
  phone: z.string().trim().max(32).nullish(),
  taxId: text(32).nullish(),
  paymentTerms: nonNeg.max(365).optional(),
  leadTimeDays: nonNeg.max(365).optional(),
});
export const UpdateSupplierBody = SupplierBody.omit({ id: true }).partial().extend({ isActive: z.boolean().optional() });

export const GoodsReceiptBody = z.object({
  id,
  supplierId: id,
  supplierInvoiceNo: text(60),
  /** When the goods arrived, if not now — a paper invoice entered the next morning (§11 `receivedAt`). */
  receivedAt: iso.optional(),
  /** The order this delivery answers, when there was one (§13.2). Most deliveries arrive unordered. */
  poId: id.nullish(),
  landedCostTotal: nonNeg,
  lines: z.array(z.object({
    id,
    productId: id,
    uom: text(16).min(1),
    factorToStockUom: pos,
    /** In the unit received: 3 spools is 3000. */
    qty: pos,
    /** Per unit received, off the paper invoice. */
    invoiceUnitCostMdram: nonNeg,
  })).min(1).max(500),
});
export type GoodsReceiptBody = z.infer<typeof GoodsReceiptBody>;

export const PurchaseReturnBody = z.object({
  id,
  receiptId: id,
  reason: text(240).min(1),
  lines: z.array(z.object({ id, receiptLineId: id, qty: pos })).min(1).max(500),
});
export type PurchaseReturnBody = z.infer<typeof PurchaseReturnBody>;

export const SupplierPaymentBody = z.object({
  id,
  supplierId: id,
  amount: pos,
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  shiftId: id.nullish(),
  allocations: z.array(z.object({ goodsReceiptId: id, amount: pos })).max(200).optional(),
});
export type SupplierPaymentBody = z.infer<typeof SupplierPaymentBody>;

export const ReverseSupplierPaymentBody = z.object({ reason: text(240).min(1), reenterSupplierId: id.nullish() });

export const WriteOffBody = z.object({ id, productId: id, qty: pos, reasonCode: WriteOffReason, note: text(240).optional() });
export const AdjustmentBody = z.object({ id, productId: id, qtyDelta: int.refine((v) => v !== 0), note: text(240).optional(), reauthGrant: z.string().min(1), reason: text(240).min(1) });
export const CostCorrectionBody = z.object({ id, goodsReceiptLineId: id, correctUnitCostMdram: nonNeg, reason: text(240).min(1) });

/** An import is the file itself: the client reads it, the server parses it (§19.1). */
export const ImportBody = z.object({
  id,
  kind: ImportKind,
  fileName: text(200),
  content: z.string().min(1).max(4_000_000),
  /** Validate and report, change nothing — the preview the owner sees before pressing the button (§7.3). */
  dryRun: z.boolean().optional(),
});
export type ImportBody = z.infer<typeof ImportBody>;

/** A counting session (§6.8): the whole shop, or one category at a time. */
export const StartStocktakeBody = z.object({ id, categoryId: id.nullish(), note: text(240).optional() });
export type StartStocktakeBody = z.infer<typeof StartStocktakeBody>;

/** A count for one product. `add` is for counting by scanning, one item at a time. */
export const StocktakeCountBody = z.object({ countedQty: nonNeg, mode: z.enum(["set", "add"]).default("set") });
export type StocktakeCountBody = z.infer<typeof StocktakeCountBody>;

/** A purchase order as drafted (§11, §13.3). Quantities and costs are per unit ordered, like an invoice. */
export const PurchaseOrderBody = z.object({
  id,
  supplierId: id,
  expectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  note: text(500).optional(),
  lines: z.array(z.object({
    id,
    productId: id,
    uom: text(16).min(1),
    factorToStockUom: pos,
    qty: pos,
    unitCostMdram: nonNeg,
  })).min(1).max(500),
});
export type PurchaseOrderBody = z.infer<typeof PurchaseOrderBody>;

/** Shelf labels (§18): which products, how many of each. */
export const LabelPrintBody = z.object({
  items: z.array(z.object({ productId: id, copies: int.min(1).max(500) })).min(1).max(500),
});
export type LabelPrintBody = z.infer<typeof LabelPrintBody>;

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
