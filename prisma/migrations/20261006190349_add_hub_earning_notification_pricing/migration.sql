-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('IN_TRANSIT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "couriers" ADD COLUMN     "hubId" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "deliveryAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "courier_earnings" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_transfers" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "fromHubId" TEXT NOT NULL,
    "toHubId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "note" TEXT,
    "dispatchedById" TEXT,
    "receivedById" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "hub_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areas" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "shipmentId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "sameCityBase" DECIMAL(10,2) NOT NULL DEFAULT 60,
    "interCityBase" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "freeWeightKg" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "perExtraKg" DECIMAL(10,2) NOT NULL DEFAULT 25,
    "expressMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_earnings_shipmentId_key" ON "courier_earnings"("shipmentId");

-- CreateIndex
CREATE INDEX "courier_earnings_courierId_status_idx" ON "courier_earnings"("courierId", "status");

-- CreateIndex
CREATE INDEX "hub_transfers_shipmentId_idx" ON "hub_transfers"("shipmentId");

-- CreateIndex
CREATE INDEX "hub_transfers_fromHubId_status_idx" ON "hub_transfers"("fromHubId", "status");

-- CreateIndex
CREATE INDEX "hub_transfers_toHubId_status_idx" ON "hub_transfers"("toHubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hubs_name_key" ON "hubs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hubs_code_key" ON "hubs"("code");

-- CreateIndex
CREATE INDEX "hubs_city_idx" ON "hubs"("city");

-- CreateIndex
CREATE INDEX "zones_hubId_idx" ON "zones"("hubId");

-- CreateIndex
CREATE UNIQUE INDEX "zones_hubId_name_key" ON "zones"("hubId", "name");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "couriers_hubId_idx" ON "couriers"("hubId");

-- AddForeignKey
ALTER TABLE "courier_earnings" ADD CONSTRAINT "courier_earnings_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_earnings" ADD CONSTRAINT "courier_earnings_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couriers" ADD CONSTRAINT "couriers_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "hub_transfers_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "hub_transfers_fromHubId_fkey" FOREIGN KEY ("fromHubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_transfers" ADD CONSTRAINT "hub_transfers_toHubId_fkey" FOREIGN KEY ("toHubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
