/** Every enumerated field in PRD §11, as Zod enums so server and client validate alike. */
import { z } from "zod";

export const Role = z.enum(["WORKER", "STOCK", "ADMIN"]);
export const SaleStatus = z.enum(["DRAFT", "HELD", "COMPLETED", "VOIDED"]);
export const PriceBasis = z.enum(["INCLUSIVE", "EXCLUSIVE"]);
export const PaymentMethod = z.enum(["CASH", "CARD", "DEBT", "TRANSFER"]);
export const ReturnTenderMethod = z.enum(["CASH", "CARD", "DEBT_REDUCTION"]);
export const TenderMethod = z.enum(["CASH", "CARD", "TRANSFER"]);
export const UnitRole = z.enum(["STOCK", "PURCHASE", "SALE"]);
export const MovementType = z.enum([
  "SALE", "SALE_RETURN", "PURCHASE_RECEIPT", "PURCHASE_RETURN",
  "ADJUSTMENT", "WRITE_OFF", "STOCKTAKE", "TRANSFER", "OPENING_BALANCE",
]);
export const WriteOffReason = z.enum(["DAMAGE", "EXPIRY", "THEFT", "INTERNAL_USE", "SAMPLE"]);
export const CashMovementType = z.enum(["PAY_IN", "PAY_OUT", "DROP", "NO_SALE", "REPAYMENT", "REFUND"]);
export const CashReasonCode = z.enum(["SUPPLIER_PAYMENT", "WAGE", "EXPENSE", "OWNER_DRAW", "CORRECTION"]);
export const ShiftStatus = z.enum(["OPEN", "CLOSING", "CLOSED"]);
export const DebtEntryType = z.enum(["CHARGE", "PAYMENT", "ADJUSTMENT"]);
export const SessionMode = z.enum(["LIVE", "PRACTICE"]);
export const PurchaseOrderStatus = z.enum(["DRAFT", "OPEN", "PARTIAL", "RECEIVED", "CANCELLED"]);
export const StocktakeStatus = z.enum(["COUNTING", "REVIEW", "APPROVED", "ABANDONED"]);
export const SupplierCreditType = z.enum(["SUPPLIER_PAYMENT", "PURCHASE_RETURN", "SUPPLIER_ADJUSTMENT"]);
export const ImportKind = z.enum(["PRODUCTS", "CUSTOMERS", "OPENING_STOCK", "OPENING_DEBTS"]);
export const ImportRowStatus = z.enum(["APPLIED", "SKIPPED", "FAILED"]);
export const BackupDestination = z.enum(["LOCAL", "USB"]);
export const BackupOutcome = z.enum(["OK", "FAILED"]);
export const TaxRegime = z.enum(["VAT", "TURNOVER", "MICRO"]);
export const ReviewFlagType = z.enum([
  "INSUFFICIENT_STOCK", "CREDIT_LIMIT_EXCEEDED_ON_SYNC", "PRODUCT_DEACTIVATED_ON_SYNC",
  "LEDGER_CACHE_DRIFT", "PRICE_CHANGED_ON_SYNC", "DEVICE_CLOCK_SKEW", "COST_VARIANCE",
  "DISCOUNT_ABOVE_CAP_ON_SYNC", "TAX_RATE_CHANGED_ON_SYNC", "CUSTOMER_BLOCKED_ON_SYNC",
  "RETURN_EXCEEDS_SOLD_ON_SYNC", "HELD_BASKET_AFTER_CLOSE",
]);

export type Role = z.infer<typeof Role>;
export type SaleStatus = z.infer<typeof SaleStatus>;
export type PriceBasis = z.infer<typeof PriceBasis>;
export type PaymentMethod = z.infer<typeof PaymentMethod>;
export type ReturnTenderMethod = z.infer<typeof ReturnTenderMethod>;
export type TenderMethod = z.infer<typeof TenderMethod>;
export type UnitRole = z.infer<typeof UnitRole>;
export type MovementType = z.infer<typeof MovementType>;
export type WriteOffReason = z.infer<typeof WriteOffReason>;
export type CashMovementType = z.infer<typeof CashMovementType>;
export type CashReasonCode = z.infer<typeof CashReasonCode>;
export type ShiftStatus = z.infer<typeof ShiftStatus>;
export type DebtEntryType = z.infer<typeof DebtEntryType>;
export type SessionMode = z.infer<typeof SessionMode>;
export type TaxRegime = z.infer<typeof TaxRegime>;
export type ReviewFlagType = z.infer<typeof ReviewFlagType>;
