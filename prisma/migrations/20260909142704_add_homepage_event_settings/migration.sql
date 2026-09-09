-- CreateEnum
CREATE TYPE "HomepageEventMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "WebsiteSettings" ADD COLUMN     "homepageAutoSwitchHours" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "homepageEventMode" "HomepageEventMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "homepageManualEventId" INTEGER;

-- AddForeignKey
ALTER TABLE "WebsiteSettings" ADD CONSTRAINT "WebsiteSettings_homepageManualEventId_fkey" FOREIGN KEY ("homepageManualEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
