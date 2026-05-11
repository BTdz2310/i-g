-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('SUBMITTING', 'SUBMITTED_OK', 'SUBMITTED_FAIL', 'ISSUED', 'CALLBACK_TIMEOUT');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "maGiaodich" TEXT NOT NULL,
    "productKind" TEXT NOT NULL,
    "status" "TxStatus" NOT NULL,
    "inboundPayload" JSONB NOT NULL,
    "pviRequest" JSONB,
    "pviResponse" JSONB,
    "pviPrKey" TEXT,
    "policyNumber" TEXT,
    "serialNumber" TEXT,
    "pdfUrl" TEXT,
    "callbackPayload" JSONB,
    "callbackAt" TIMESTAMP(3),
    "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "maGiaodich" TEXT,
    "request" JSONB,
    "response" JSONB,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_maGiaodich_key" ON "Transaction"("maGiaodich");

-- CreateIndex
CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_policyNumber_idx" ON "Transaction"("policyNumber");

-- CreateIndex
CREATE INDEX "ApiCallLog_maGiaodich_idx" ON "ApiCallLog"("maGiaodich");

-- CreateIndex
CREATE INDEX "ApiCallLog_createdAt_idx" ON "ApiCallLog"("createdAt");
