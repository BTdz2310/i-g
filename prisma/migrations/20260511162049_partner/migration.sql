-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 0,
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSecret" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "status" "SecretStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_clientId_key" ON "Partner"("clientId");

-- CreateIndex
CREATE INDEX "PartnerSecret_partnerId_idx" ON "PartnerSecret"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerSecret_keyId_idx" ON "PartnerSecret"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSecret_partnerId_keyId_key" ON "PartnerSecret"("partnerId", "keyId");

-- AddForeignKey
ALTER TABLE "PartnerSecret" ADD CONSTRAINT "PartnerSecret_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
