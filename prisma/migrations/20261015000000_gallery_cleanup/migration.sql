-- Additive migration only. No existing media or records are modified.
CREATE TABLE "GalleryDeletionOperation" (
  "id" TEXT NOT NULL,
  "requestedIds" INTEGER[] NOT NULL,
  "deletedIds" INTEGER[] NOT NULL,
  "notFoundIds" INTEGER[] NOT NULL,
  "preservedIds" INTEGER[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GalleryDeletionOperation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GalleryCleanupTask" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GalleryCleanupTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GalleryCleanupTask_status_check" CHECK ("status" IN ('pending', 'succeeded', 'failed')),
  CONSTRAINT "GalleryCleanupTask_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "GalleryCleanupTask_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "GalleryDeletionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GalleryCleanupTask_publicId_key" ON "GalleryCleanupTask"("publicId");
CREATE INDEX "GalleryCleanupTask_operationId_status_idx" ON "GalleryCleanupTask"("operationId", "status");
