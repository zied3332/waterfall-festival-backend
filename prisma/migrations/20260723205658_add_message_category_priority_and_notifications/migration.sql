-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('GENERAL', 'TICKETS', 'VIP', 'PARTNERSHIP', 'VENDOR', 'MEDIA', 'LOST_AND_FOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "MessagePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONTACT_MESSAGE', 'EVENT', 'TICKET', 'GALLERY', 'FAQ', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "category" "MessageCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "priority" "MessagePriority" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "contactMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_contactMessageId_idx" ON "Notification"("contactMessageId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_category_idx" ON "ContactMessage"("category");

-- CreateIndex
CREATE INDEX "ContactMessage_priority_idx" ON "ContactMessage"("priority");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
