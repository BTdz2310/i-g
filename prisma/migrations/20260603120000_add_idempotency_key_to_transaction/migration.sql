-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
-- NULL <> NULL in Postgres, nên các đơn cũ / không truyền key sẽ không xung đột.
CREATE UNIQUE INDEX "Transaction_partnerId_idempotencyKey_key" ON "Transaction"("partnerId", "idempotencyKey");
