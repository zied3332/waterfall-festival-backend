-- CreateEnum
CREATE TYPE "GalleryMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "GalleryImage" ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "homepageSortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mediaType" "GalleryMediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "width" INTEGER;

-- CreateIndex
CREATE INDEX "GalleryImage_mediaType_idx" ON "GalleryImage"("mediaType");

-- CreateIndex
CREATE INDEX "GalleryImage_showOnHomepage_idx" ON "GalleryImage"("showOnHomepage");

-- CreateIndex
CREATE INDEX "GalleryImage_homepageSortOrder_idx" ON "GalleryImage"("homepageSortOrder");
