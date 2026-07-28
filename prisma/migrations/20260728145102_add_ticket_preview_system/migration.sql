-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'AVAILABLE', 'LIMITED', 'SOLD_OUT', 'EXPIRED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('GENERAL', 'EARLY_BIRD', 'VIP', 'GROUP', 'PACKAGE', 'ADD_ON', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketAvailabilityMode" AS ENUM ('MANUAL', 'EXTERNAL_API', 'HIDDEN');

-- CreateEnum
CREATE TYPE "TicketProvider" AS ENUM ('EVENTPOP', 'OTHER');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "externalEventId" TEXT,
ADD COLUMN     "ticketProvider" "TicketProvider" NOT NULL DEFAULT 'EVENTPOP',
ADD COLUMN     "ticketPurchaseUrl" TEXT;

-- CreateTable
CREATE TABLE "TicketPreview" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "category" "TicketCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(10,2) NOT NULL,
    "originalPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "availabilityMode" "TicketAvailabilityMode" NOT NULL DEFAULT 'HIDDEN',
    "totalQuantity" INTEGER,
    "remainingQuantity" INTEGER,
    "availabilityLabel" TEXT,
    "saleStartsAt" TIMESTAMP(3),
    "saleEndsAt" TIMESTAMP(3),
    "minimumPerOrder" INTEGER,
    "maximumPerOrder" INTEGER,
    "externalPurchaseUrl" TEXT,
    "externalTicketId" TEXT,
    "badge" TEXT,
    "imageUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketBenefit" (
    "id" SERIAL NOT NULL,
    "ticketPreviewId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketPreview_eventId_idx" ON "TicketPreview"("eventId");

-- CreateIndex
CREATE INDEX "TicketPreview_status_idx" ON "TicketPreview"("status");

-- CreateIndex
CREATE INDEX "TicketPreview_category_idx" ON "TicketPreview"("category");

-- CreateIndex
CREATE INDEX "TicketPreview_availabilityMode_idx" ON "TicketPreview"("availabilityMode");

-- CreateIndex
CREATE INDEX "TicketPreview_isFeatured_idx" ON "TicketPreview"("isFeatured");

-- CreateIndex
CREATE INDEX "TicketPreview_sortOrder_idx" ON "TicketPreview"("sortOrder");

-- CreateIndex
CREATE INDEX "TicketPreview_saleStartsAt_idx" ON "TicketPreview"("saleStartsAt");

-- CreateIndex
CREATE INDEX "TicketPreview_saleEndsAt_idx" ON "TicketPreview"("saleEndsAt");

-- CreateIndex
CREATE INDEX "TicketPreview_externalTicketId_idx" ON "TicketPreview"("externalTicketId");

-- CreateIndex
CREATE INDEX "TicketPreview_createdAt_idx" ON "TicketPreview"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPreview_eventId_slug_key" ON "TicketPreview"("eventId", "slug");

-- CreateIndex
CREATE INDEX "TicketBenefit_ticketPreviewId_idx" ON "TicketBenefit"("ticketPreviewId");

-- CreateIndex
CREATE INDEX "TicketBenefit_sortOrder_idx" ON "TicketBenefit"("sortOrder");

-- CreateIndex
CREATE INDEX "TicketBenefit_createdAt_idx" ON "TicketBenefit"("createdAt");

-- CreateIndex
CREATE INDEX "Event_ticketProvider_idx" ON "Event"("ticketProvider");

-- CreateIndex
CREATE INDEX "Event_externalEventId_idx" ON "Event"("externalEventId");

-- AddForeignKey
ALTER TABLE "TicketPreview" ADD CONSTRAINT "TicketPreview_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketBenefit" ADD CONSTRAINT "TicketBenefit_ticketPreviewId_fkey" FOREIGN KEY ("ticketPreviewId") REFERENCES "TicketPreview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
