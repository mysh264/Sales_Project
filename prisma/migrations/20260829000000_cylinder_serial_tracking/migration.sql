-- CreateEnum
CREATE TYPE "CylinderStatus" AS ENUM ('AVAILABLE', 'FILLED', 'OUT', 'RETURNED', 'RETIRED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "shareTokenExpires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Cylinder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "status" "CylinderStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cylinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CylinderEvent" (
    "id" TEXT NOT NULL,
    "cylinderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "CylinderMovementType" NOT NULL,
    "invoiceId" TEXT,
    "reconciliationId" TEXT,
    "salesmanId" TEXT,
    "customerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CylinderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cylinder_branchId_idx" ON "Cylinder"("branchId");

-- CreateIndex
CREATE INDEX "Cylinder_productId_idx" ON "Cylinder"("productId");

-- CreateIndex
CREATE INDEX "Cylinder_status_idx" ON "Cylinder"("status");

-- CreateIndex
CREATE INDEX "Cylinder_customerId_idx" ON "Cylinder"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Cylinder_branchId_serial_key" ON "Cylinder"("branchId", "serial");

-- CreateIndex
CREATE INDEX "CylinderEvent_cylinderId_createdAt_idx" ON "CylinderEvent"("cylinderId", "createdAt");

-- CreateIndex
CREATE INDEX "CylinderEvent_branchId_idx" ON "CylinderEvent"("branchId");

-- CreateIndex
CREATE INDEX "CylinderEvent_customerId_idx" ON "CylinderEvent"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shareToken_key" ON "Customer"("shareToken");

-- AddForeignKey
ALTER TABLE "Cylinder" ADD CONSTRAINT "Cylinder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cylinder" ADD CONSTRAINT "Cylinder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cylinder" ADD CONSTRAINT "Cylinder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_cylinderId_fkey" FOREIGN KEY ("cylinderId") REFERENCES "Cylinder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "DailyReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CylinderEvent" ADD CONSTRAINT "CylinderEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

