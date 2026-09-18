/**
 * Post-process a Prisma-generated migration: append STRICT to every table and add the
 * CHECK constraints §11 requires. Prisma emits neither (§11 "Table storage", §23.1 item 1).
 *
 *   node --experimental-strip-types prisma/strictify.ts prisma/migrations/<dir>/migration.sql
 *
 * Idempotent. A schema test (src/lib/schema.test.ts) asserts the result is still there.
 */
import { readFileSync, writeFileSync } from "node:fs";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/** Column → allowed values, per table. Mirrors packages/shared/src/enums.ts. */
export const ENUM_CHECKS: Record<string, Record<string, readonly string[]>> = {
  ProductUnit: { role: ["STOCK", "PURCHASE", "SALE"] },
  Sale: { status: ["DRAFT", "HELD", "COMPLETED", "VOIDED"], priceBasis: ["INCLUSIVE", "EXCLUSIVE"] },
  Payment: { method: ["CASH", "CARD", "DEBT", "TRANSFER"] },
  SaleReturn: { priceBasis: ["INCLUSIVE", "EXCLUSIVE"] },
  SaleReturnTender: { method: ["CASH", "CARD", "DEBT_REDUCTION"] },
  PurchaseOrder: { status: ["DRAFT", "OPEN", "PARTIAL", "RECEIVED", "CANCELLED"] },
  SupplierPayment: { method: ["CASH", "CARD", "TRANSFER"] },
  SupplierAdjustment: { type: ["CREDIT"] },
  SupplierAllocation: { creditType: ["SUPPLIER_PAYMENT", "PURCHASE_RETURN", "SUPPLIER_ADJUSTMENT"] },
  StockMovement: {
    type: ["SALE", "SALE_RETURN", "PURCHASE_RECEIPT", "PURCHASE_RETURN", "ADJUSTMENT", "WRITE_OFF", "STOCKTAKE", "TRANSFER", "OPENING_BALANCE"],
  },
  ReviewFlag: {
    type: ["INSUFFICIENT_STOCK", "CREDIT_LIMIT_EXCEEDED_ON_SYNC", "PRODUCT_DEACTIVATED_ON_SYNC", "LEDGER_CACHE_DRIFT", "PRICE_CHANGED_ON_SYNC", "DEVICE_CLOCK_SKEW", "COST_VARIANCE", "DISCOUNT_ABOVE_CAP_ON_SYNC", "TAX_RATE_CHANGED_ON_SYNC", "CUSTOMER_BLOCKED_ON_SYNC", "RETURN_EXCEEDS_SOLD_ON_SYNC", "HELD_BASKET_AFTER_CLOSE"],
  },
  DebtEntry: { type: ["CHARGE", "PAYMENT", "ADJUSTMENT"] },
  Shift: { status: ["OPEN", "CLOSING", "CLOSED"] },
  CashMovement: { type: ["PAY_IN", "PAY_OUT", "DROP", "NO_SALE", "REPAYMENT", "REFUND"] },
  User: { role: ["OWNER", "MANAGER", "EMPLOYEE"] },
  Session: { mode: ["LIVE", "PRACTICE"] },
  Stocktake: { status: ["COUNTING", "REVIEW", "APPROVED", "ABANDONED"] },
  BackupRun: { destination: ["LOCAL", "USB"], outcome: ["OK", "FAILED"] },
  ImportBatch: { kind: ["PRODUCTS", "CUSTOMERS", "OPENING_STOCK", "OPENING_DEBTS"] },
  ImportRow: { status: ["APPLIED", "SKIPPED", "FAILED"] },
};

/** Conditional and range rules from §11's validation table. */
export const EXTRA_CHECKS: Record<string, readonly string[]> = {
  Product: ["decimalPlaces BETWEEN 0 AND 3", "sellPriceMdram >= 0", "avgCostMdram IS NULL OR avgCostMdram >= 0", "trackStock IN (0, 1)", "isActive IN (0, 1)"],
  ProductBarcode: ["isPrimary IN (0, 1)", "length(barcode) BETWEEN 1 AND 48"],
  ProductUnit: ["factorToStockUom > 0"],
  SaleLine: ["qty > 0", "discountAmount >= 0", "priceOverridden IN (0, 1)", "unitPriceMdram >= 0"],
  Payment: ["amount > 0"],
  SaleReturnTender: ["amount > 0"],
  SaleReturnLine: ["qty > 0", "restock IN (0, 1)", "discountShare >= 0"],
  StockMovement: [
    "(type = 'WRITE_OFF') = (reasonCode IS NOT NULL)",
    "reasonCode IS NULL OR reasonCode IN ('DAMAGE', 'EXPIRY', 'THEFT', 'INTERNAL_USE', 'SAMPLE')",
    "type NOT IN ('PURCHASE_RECEIPT', 'PURCHASE_RETURN') OR unitCostMdram IS NOT NULL",
    "unitCostMdram IS NULL OR unitCostMdram >= 0",
  ],
  Customer: ["creditLimit >= 0", "isBlocked IN (0, 1)", "isActive IN (0, 1)", "discountBp BETWEEN 0 AND 10000", "anonymisedAt IS NOT NULL OR fullName IS NOT NULL"],
  DebtEntry: ["amount > 0", "(type = 'PAYMENT') = (method IS NOT NULL)", "method IS NULL OR method IN ('CASH', 'CARD', 'TRANSFER')"],
  DebtAllocation: ["amount > 0"],
  AllocationOverride: ["amount > 0"],
  Shift: ["openingFloat >= 0", "countedCash IS NULL OR countedCash >= 0"],
  CashMovement: [
    "amount >= 0", "(type = 'NO_SALE') = (amount = 0)",
    "(type = 'PAY_OUT') = (reasonCode IS NOT NULL)",
    "reasonCode IS NULL OR reasonCode IN ('SUPPLIER_PAYMENT', 'WAGE', 'EXPENSE', 'OWNER_DRAW', 'CORRECTION')",
  ],
  SupplierPayment: ["amount > 0"],
  SupplierAdjustment: ["amount > 0"],
  SupplierAllocation: ["amount > 0"],
  CostCorrection: ["correctUnitCostMdram <> wrongUnitCostMdram", "affectedFrom <= affectedTo"],
  PurchaseOrder: ["total >= 0"],
  PurchaseOrderLine: ["qtyOrdered > 0", "qtyReceived >= 0", "unitCostMdram >= 0", "factorToStockUom > 0"],
  Stocktake: ["snapshotSeq >= 0"],
  StocktakeLine: ["countedQty IS NULL OR countedQty >= 0", "(countedQty IS NULL) = (countedSeq IS NULL)"],
  Device: ["length(prefix) = 2", "lastSequence >= 0", "outboxDepth >= 0", "parkedDepth >= 0", "isActive IN (0, 1)"],
  User: ["isActive IN (0, 1)", "failedAttempts >= 0"],
};

export function strictify(sql: string): string {
  return sql.replace(/CREATE TABLE "(\w+)" \(([\s\S]*?)\n\)(?: STRICT)?;/g, (_m, table: string, body: string) => {
    // A SQLite table redefinition creates "new_X" before renaming it to X.
    const name = table.replace(/^new_/, "");
    if (name.startsWith("_prisma")) return `CREATE TABLE "${table}" (${body}\n);`;
    const checks = [
      ...Object.entries(ENUM_CHECKS[name] ?? {}).map(([col, values]) => `"${col}" IN (${inList(values)})`),
      ...(EXTRA_CHECKS[name] ?? []),
    ];
    const cleaned = body.replace(/,\n\s+CHECK \([\s\S]*$/, "");
    const withChecks = checks.length ? `${cleaned},\n    ${checks.map((c) => `CHECK (${c})`).join(",\n    ")}` : cleaned;
    return `CREATE TABLE "${table}" (${withChecks}\n) STRICT;`;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const file of process.argv.slice(2)) {
    writeFileSync(file, strictify(readFileSync(file, "utf8")));
    console.log(`strictified ${file}`);
  }
}
