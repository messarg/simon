-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatar" BLOB;
ALTER TABLE "User" ADD COLUMN "avatarType" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUpdatedAt" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CashMovement_userId_createdAt_idx" ON "CashMovement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_userId_businessDate_idx" ON "Sale"("userId", "businessDate");

-- CreateIndex
CREATE INDEX "StockMovement_userId_seq_idx" ON "StockMovement"("userId", "seq");
