-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expectedAt" TEXT,
    "total" INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "openedAt" TEXT,
    "cancelledAt" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("status" IN ('DRAFT', 'OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED')),
    CHECK (total >= 0)
) STRICT;
INSERT INTO "new_PurchaseOrder" ("createdAt", "expectedAt", "id", "number", "status", "supplierId", "total") SELECT "createdAt", "expectedAt", "id", "number", "status", "supplierId", "total" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");
CREATE TABLE "new_PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCostMdram" INTEGER NOT NULL,
    "uom" TEXT NOT NULL DEFAULT '',
    "factorToStockUom" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (qtyOrdered > 0),
    CHECK (qtyReceived >= 0),
    CHECK (unitCostMdram >= 0),
    CHECK (factorToStockUom > 0)
) STRICT;
INSERT INTO "new_PurchaseOrderLine" ("id", "poId", "productId", "qtyOrdered", "qtyReceived", "unitCostMdram") SELECT "id", "poId", "productId", "qtyOrdered", "qtyReceived", "unitCostMdram" FROM "PurchaseOrderLine";
DROP TABLE "PurchaseOrderLine";
ALTER TABLE "new_PurchaseOrderLine" RENAME TO "PurchaseOrderLine";
CREATE INDEX "PurchaseOrderLine_poId_idx" ON "PurchaseOrderLine"("poId");
CREATE TABLE "new_Stocktake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "approvedAt" TEXT,
    "approvedBy" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "snapshotSeq" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "abandonedAt" TEXT,
    "varianceTotal" INTEGER NOT NULL DEFAULT 0,
    CHECK ("status" IN ('COUNTING', 'REVIEW', 'APPROVED', 'ABANDONED')),
    CHECK (snapshotSeq >= 0)
) STRICT;
INSERT INTO "new_Stocktake" ("approvedAt", "approvedBy", "id", "note", "startedAt", "startedBy", "status") SELECT "approvedAt", "approvedBy", "id", "note", "startedAt", "startedBy", "status" FROM "Stocktake";
DROP TABLE "Stocktake";
ALTER TABLE "new_Stocktake" RENAME TO "Stocktake";
CREATE TABLE "new_StocktakeLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stocktakeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "varianceValue" INTEGER NOT NULL DEFAULT 0,
    "countedSeq" INTEGER,
    "countedAt" TEXT,
    "countedBy" TEXT,
    "varianceQty" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StocktakeLine_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (countedQty IS NULL OR countedQty >= 0),
    CHECK ((countedQty IS NULL) = (countedSeq IS NULL))
) STRICT;
INSERT INTO "new_StocktakeLine" ("countedQty", "expectedQty", "id", "productId", "stocktakeId", "varianceValue") SELECT "countedQty", "expectedQty", "id", "productId", "stocktakeId", "varianceValue" FROM "StocktakeLine";
DROP TABLE "StocktakeLine";
ALTER TABLE "new_StocktakeLine" RENAME TO "StocktakeLine";
CREATE INDEX "StocktakeLine_stocktakeId_idx" ON "StocktakeLine"("stocktakeId");
CREATE UNIQUE INDEX "StocktakeLine_stocktakeId_productId_key" ON "StocktakeLine"("stocktakeId", "productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
