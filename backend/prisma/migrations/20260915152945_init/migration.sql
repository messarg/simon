-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL,
    "categoryId" TEXT,
    "stockUom" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "decimalPlaces" INTEGER NOT NULL,
    "avgCostMdram" INTEGER,
    "sellPriceMdram" INTEGER NOT NULL,
    "taxCategory" TEXT NOT NULL DEFAULT 'STANDARD',
    "defaultSupplierId" TEXT,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "reorderQty" INTEGER NOT NULL DEFAULT 0,
    "tilePinnedAt" TEXT,
    "trackStock" INTEGER NOT NULL DEFAULT 1,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (decimalPlaces BETWEEN 0 AND 3),
    CHECK (sellPriceMdram >= 0),
    CHECK (avgCostMdram IS NULL OR avgCostMdram >= 0),
    CHECK (trackStock IN (0, 1)),
    CHECK (isActive IN (0, 1))
) STRICT;

-- CreateTable
CREATE TABLE "ProductBarcode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "isPrimary" INTEGER NOT NULL DEFAULT 0,
    "retiredAt" TEXT,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "ProductBarcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (isPrimary IN (0, 1)),
    CHECK (length(barcode) BETWEEN 1 AND 48)
) STRICT;

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "factorToStockUom" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "barcode" TEXT,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("role" IN ('STOCK', 'PURCHASE', 'SALE')),
    CHECK (factorToStockUom > 0)
) STRICT;

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sellPriceMdram" INTEGER NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriceHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL,
    "discountReason" TEXT,
    "taxTotal" INTEGER NOT NULL,
    "priceBasis" TEXT NOT NULL,
    "roundingAdjustment" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "businessDate" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "reversesId" TEXT,
    "fiscalReceiptId" TEXT,
    CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('DRAFT', 'HELD', 'COMPLETED', 'VOIDED')),
    CHECK ("priceBasis" IN ('INCLUSIVE', 'EXCLUSIVE'))
) STRICT;

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "uom" TEXT NOT NULL,
    "factorToStockUom" INTEGER NOT NULL,
    "unitPriceMdram" INTEGER NOT NULL,
    "unitCostMdram" INTEGER,
    "taxRateBp" INTEGER NOT NULL,
    "lineTax" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "discountReason" TEXT,
    "priceOverridden" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (qty > 0),
    CHECK (discountAmount >= 0),
    CHECK (priceOverridden IN (0, 1)),
    CHECK (unitPriceMdram >= 0)
) STRICT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tenderedAmount" INTEGER,
    "changeGiven" INTEGER,
    CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("method" IN ('CASH', 'CARD', 'DEBT', 'TRANSFER')),
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalSaleId" TEXT,
    "shiftId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priceBasis" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "reversesId" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "SaleReturn_originalSaleId_fkey" FOREIGN KEY ("originalSaleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleReturn_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("priceBasis" IN ('INCLUSIVE', 'EXCLUSIVE'))
) STRICT;

-- CreateTable
CREATE TABLE "SaleReturnTender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "SaleReturnTender_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("method" IN ('CASH', 'CARD', 'DEBT_REDUCTION')),
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "SaleReturnLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "saleLineId" TEXT,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCostMdram" INTEGER,
    "taxRateBp" INTEGER NOT NULL,
    "lineTax" INTEGER NOT NULL,
    "discountShare" INTEGER NOT NULL,
    "refundAmount" INTEGER NOT NULL,
    "restock" INTEGER NOT NULL,
    CONSTRAINT "SaleReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleReturnLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (qty > 0),
    CHECK (restock IN (0, 1)),
    CHECK (discountShare >= 0)
) STRICT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL,
    "taxId" TEXT,
    "phone" TEXT,
    "paymentTerms" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
) STRICT;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expectedAt" TEXT,
    "total" INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('DRAFT', 'OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'))
) STRICT;

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCostMdram" INTEGER NOT NULL,
    CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poId" TEXT,
    "receivedAt" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierInvoiceNo" TEXT NOT NULL,
    "landedCostTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "reversesId" TEXT,
    CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "uom" TEXT NOT NULL,
    "factorToStockUom" INTEGER NOT NULL,
    "invoiceUnitCostMdram" INTEGER NOT NULL,
    "landedUnitCostMdram" INTEGER NOT NULL,
    CONSTRAINT "GoodsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "CostCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goodsReceiptLineId" TEXT NOT NULL,
    "wrongUnitCostMdram" INTEGER NOT NULL,
    "correctUnitCostMdram" INTEGER NOT NULL,
    "affectedFrom" TEXT NOT NULL,
    "affectedTo" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "CostCorrection_goodsReceiptLineId_fkey" FOREIGN KEY ("goodsReceiptLineId") REFERENCES "GoodsReceiptLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (correctUnitCostMdram <> wrongUnitCostMdram),
    CHECK (affectedFrom <= affectedTo)
) STRICT;

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reversesId" TEXT,
    CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("method" IN ('CASH', 'CARD', 'TRANSFER')),
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "SupplierAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "reversesId" TEXT,
    CONSTRAINT "SupplierAdjustment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("type" IN ('CREDIT')),
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "SupplierAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditType" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "SupplierAllocation_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("creditType" IN ('SUPPLIER_PAYMENT', 'PURCHASE_RETURN', 'SUPPLIER_ADJUSTMENT')),
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "receiptId" TEXT,
    "reason" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "landedCostLost" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturn_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "PurchaseReturnLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "receiptLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "landedUnitCostMdram" INTEGER NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    CONSTRAINT "PurchaseReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturnLine_receiptLineId_fkey" FOREIGN KEY ("receiptLineId") REFERENCES "GoodsReceiptLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "unitCostMdram" INTEGER,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT,
    "reasonCode" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("type" IN ('SALE', 'SALE_RETURN', 'PURCHASE_RECEIPT', 'PURCHASE_RETURN', 'ADJUSTMENT', 'WRITE_OFF', 'STOCKTAKE', 'TRANSFER', 'OPENING_BALANCE')),
    CHECK ((type = 'WRITE_OFF') = (reasonCode IS NOT NULL)),
    CHECK (reasonCode IS NULL OR reasonCode IN ('DAMAGE', 'EXPIRY', 'THEFT', 'INTERNAL_USE', 'SAMPLE')),
    CHECK (type NOT IN ('PURCHASE_RECEIPT', 'PURCHASE_RETURN') OR unitCostMdram IS NOT NULL),
    CHECK (unitCostMdram IS NULL OR unitCostMdram >= 0)
) STRICT;

-- CreateTable
CREATE TABLE "ReviewFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "productId" TEXT,
    "customerId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "resolvedAt" TEXT,
    "resolvedBy" TEXT,
    CHECK ("type" IN ('INSUFFICIENT_STOCK', 'CREDIT_LIMIT_EXCEEDED_ON_SYNC', 'PRODUCT_DEACTIVATED_ON_SYNC', 'LEDGER_CACHE_DRIFT', 'PRICE_CHANGED_ON_SYNC', 'DEVICE_CLOCK_SKEW', 'COST_VARIANCE', 'DISCOUNT_ABOVE_CAP_ON_SYNC', 'TAX_RATE_CHANGED_ON_SYNC', 'CUSTOMER_BLOCKED_ON_SYNC', 'RETURN_EXCEEDS_SOLD_ON_SYNC', 'HELD_BASKET_AFTER_CLOSE'))
) STRICT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT,
    "nameSearch" TEXT NOT NULL,
    "phone" TEXT,
    "discountBp" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" INTEGER NOT NULL,
    "isBlocked" INTEGER NOT NULL DEFAULT 0,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "mergedIntoId" TEXT,
    "anonymisedAt" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "Customer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (creditLimit >= 0),
    CHECK (isBlocked IN (0, 1)),
    CHECK (isActive IN (0, 1)),
    CHECK (discountBp BETWEEN 0 AND 10000),
    CHECK (anonymisedAt IS NOT NULL OR fullName IS NOT NULL)
) STRICT;

-- CreateTable
CREATE TABLE "DebtEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "saleId" TEXT,
    "dueDate" TEXT,
    "reversesId" TEXT,
    "createdAt" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DebtEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DebtEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DebtEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("type" IN ('CHARGE', 'PAYMENT', 'ADJUSTMENT')),
    CHECK (amount > 0),
    CHECK ((type = 'PAYMENT') = (method IS NOT NULL)),
    CHECK (method IS NULL OR method IN ('CASH', 'CARD', 'TRANSFER'))
) STRICT;

-- CreateTable
CREATE TABLE "DebtAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditEntryId" TEXT NOT NULL,
    "chargeEntryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "AllocationOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditEntryId" TEXT NOT NULL,
    "chargeEntryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CHECK (amount > 0)
) STRICT;

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "openedAt" TEXT NOT NULL,
    "closedAt" TEXT,
    "openingFloat" INTEGER NOT NULL,
    "expectedCash" INTEGER,
    "countedCash" INTEGER,
    "countedBreakdown" TEXT,
    "variance" INTEGER,
    "status" TEXT NOT NULL,
    "unsyncedAtClose" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('OPEN', 'CLOSING', 'CLOSED')),
    CHECK (openingFloat >= 0),
    CHECK (countedCash IS NULL OR countedCash >= 0)
) STRICT;

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reasonCode" TEXT,
    "reason" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reversesId" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "CashMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("type" IN ('PAY_IN', 'PAY_OUT', 'DROP', 'NO_SALE', 'REPAYMENT', 'REFUND')),
    CHECK (amount >= 0),
    CHECK ((type = 'NO_SALE') = (amount = 0)),
    CHECK ((type = 'PAY_OUT') = (reasonCode IS NOT NULL)),
    CHECK (reasonCode IS NULL OR reasonCode IN ('SUPPLIER_PAYMENT', 'WAGE', 'EXPENSE', 'OWNER_DRAW', 'CORRECTION'))
) STRICT;

-- CreateTable
CREATE TABLE "ShiftLateArrival" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "arrivedAt" TEXT NOT NULL,
    CONSTRAINT "ShiftLateArrival_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "recoveryCodeHash" TEXT,
    "role" TEXT NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TEXT,
    "coachMarksSeen" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    CHECK ("role" IN ('WORKER', 'STOCK', 'ADMIN')),
    CHECK (isActive IN (0, 1)),
    CHECK (failedAttempts >= 0)
) STRICT;

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "registeredAt" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "blockStart" INTEGER,
    "blockEnd" INTEGER,
    "outboxDepth" INTEGER NOT NULL DEFAULT 0,
    "outboxOldestAt" TEXT,
    "parkedDepth" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    CHECK (length(prefix) = 2),
    CHECK (lastSequence >= 0),
    CHECK (outboxDepth >= 0),
    CHECK (parkedDepth >= 0),
    CHECK (isActive IN (0, 1))
) STRICT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "shiftId" TEXT,
    "createdAt" TEXT NOT NULL,
    "lastSeenAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "revokedAt" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("mode" IN ('LIVE', 'PRACTICE'))
) STRICT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "reason" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "Stocktake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "approvedAt" TEXT,
    "approvedBy" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    CHECK ("status" IN ('COUNTING', 'REVIEW', 'APPROVED', 'ABANDONED'))
) STRICT;

-- CreateTable
CREATE TABLE "StocktakeLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stocktakeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "varianceValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StocktakeLine_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "ProductStats" (
    "productId" TEXT NOT NULL PRIMARY KEY,
    "avgDailyQty30d" INTEGER NOT NULL,
    "lastSoldAt" TEXT,
    "daysSinceLastSale" INTEGER,
    "computedAt" TEXT NOT NULL,
    CONSTRAINT "ProductStats_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
) STRICT;

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "destination" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    CHECK ("destination" IN ('LOCAL', 'USB')),
    CHECK ("outcome" IN ('OK', 'FAILED'))
) STRICT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
) STRICT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "userId" TEXT NOT NULL,
    CHECK ("kind" IN ('PRODUCTS', 'CUSTOMERS', 'OPENING_STOCK', 'OPENING_DEBTS'))
) STRICT;

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "naturalKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entityId" TEXT,
    "error" TEXT,
    CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('APPLIED', 'SKIPPED', 'FAILED'))
) STRICT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_nameSearch_idx" ON "Product"("nameSearch");

-- CreateIndex
CREATE INDEX "Product_updatedAt_idx" ON "Product"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBarcode_barcode_key" ON "ProductBarcode"("barcode");

-- CreateIndex
CREATE INDEX "ProductBarcode_productId_idx" ON "ProductBarcode"("productId");

-- CreateIndex
CREATE INDEX "ProductUnit_productId_idx" ON "ProductUnit"("productId");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_effectiveFrom_idx" ON "PriceHistory"("productId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");

-- CreateIndex
CREATE INDEX "Sale_businessDate_idx" ON "Sale"("businessDate");

-- CreateIndex
CREATE INDEX "Sale_completedAt_idx" ON "Sale"("completedAt");

-- CreateIndex
CREATE INDEX "Sale_shiftId_status_idx" ON "Sale"("shiftId", "status");

-- CreateIndex
CREATE INDEX "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "SaleReturn_originalSaleId_idx" ON "SaleReturn"("originalSaleId");

-- CreateIndex
CREATE INDEX "SaleReturn_shiftId_idx" ON "SaleReturn"("shiftId");

-- CreateIndex
CREATE INDEX "SaleReturn_businessDate_idx" ON "SaleReturn"("businessDate");

-- CreateIndex
CREATE INDEX "SaleReturnTender_returnId_idx" ON "SaleReturnTender"("returnId");

-- CreateIndex
CREATE INDEX "SaleReturnLine_returnId_idx" ON "SaleReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "SaleReturnLine_saleLineId_idx" ON "SaleReturnLine"("saleLineId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_poId_idx" ON "PurchaseOrderLine"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_number_key" ON "GoodsReceipt"("number");

-- CreateIndex
CREATE INDEX "GoodsReceipt_supplierId_receivedAt_idx" ON "GoodsReceipt"("supplierId", "receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_receiptId_idx" ON "GoodsReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_productId_idx" ON "GoodsReceiptLine"("productId");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAdjustment_supplierId_idx" ON "SupplierAdjustment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAllocation_goodsReceiptId_idx" ON "SupplierAllocation"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "SupplierAllocation_creditType_creditId_idx" ON "SupplierAllocation"("creditType", "creditId");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_returnId_idx" ON "PurchaseReturnLine"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_seq_key" ON "StockMovement"("seq");

-- CreateIndex
CREATE INDEX "StockMovement_productId_seq_idx" ON "StockMovement"("productId", "seq");

-- CreateIndex
CREATE INDEX "StockMovement_sourceType_sourceId_idx" ON "StockMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ReviewFlag_resolvedAt_type_idx" ON "ReviewFlag"("resolvedAt", "type");

-- CreateIndex
CREATE INDEX "ReviewFlag_sourceType_sourceId_idx" ON "ReviewFlag"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_nameSearch_idx" ON "Customer"("nameSearch");

-- CreateIndex
CREATE INDEX "Customer_updatedAt_idx" ON "Customer"("updatedAt");

-- CreateIndex
CREATE INDEX "DebtEntry_customerId_createdAt_idx" ON "DebtEntry"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "DebtAllocation_chargeEntryId_idx" ON "DebtAllocation"("chargeEntryId");

-- CreateIndex
CREATE INDEX "DebtAllocation_creditEntryId_idx" ON "DebtAllocation"("creditEntryId");

-- CreateIndex
CREATE INDEX "AllocationOverride_creditEntryId_idx" ON "AllocationOverride"("creditEntryId");

-- CreateIndex
CREATE INDEX "Shift_userId_status_idx" ON "Shift"("userId", "status");

-- CreateIndex
CREATE INDEX "Shift_status_idx" ON "Shift"("status");

-- CreateIndex
CREATE INDEX "CashMovement_shiftId_idx" ON "CashMovement"("shiftId");

-- CreateIndex
CREATE INDEX "CashMovement_sourceType_sourceId_idx" ON "CashMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ShiftLateArrival_shiftId_idx" ON "ShiftLateArrival"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_prefix_key" ON "Device"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

-- CreateIndex
CREATE INDEX "Session_shiftId_idx" ON "Session"("shiftId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_entityId_idx" ON "AuditLog"("action", "entityId");

-- CreateIndex
CREATE INDEX "StocktakeLine_stocktakeId_idx" ON "StocktakeLine"("stocktakeId");

-- CreateIndex
CREATE INDEX "Setting_updatedAt_idx" ON "Setting"("updatedAt");

-- CreateIndex
CREATE INDEX "ImportRow_naturalKey_status_idx" ON "ImportRow"("naturalKey", "status");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_idx" ON "ImportRow"("batchId");
