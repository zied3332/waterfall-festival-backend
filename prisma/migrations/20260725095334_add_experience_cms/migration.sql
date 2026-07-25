-- CreateTable
CREATE TABLE "ExperiencePage" (
    "id" SERIAL NOT NULL,
    "heroBadge" TEXT,
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT,
    "heroDescription" TEXT,
    "storyEyebrow" TEXT,
    "storyTitle" TEXT NOT NULL,
    "storyDescription" TEXT NOT NULL,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperiencePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceHighlight" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "experiencePageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceImage" (
    "id" SERIAL NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "experiencePageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExperiencePage_isPublished_idx" ON "ExperiencePage"("isPublished");

-- CreateIndex
CREATE INDEX "ExperiencePage_createdAt_idx" ON "ExperiencePage"("createdAt");

-- CreateIndex
CREATE INDEX "ExperienceHighlight_experiencePageId_idx" ON "ExperienceHighlight"("experiencePageId");

-- CreateIndex
CREATE INDEX "ExperienceHighlight_sortOrder_idx" ON "ExperienceHighlight"("sortOrder");

-- CreateIndex
CREATE INDEX "ExperienceHighlight_isVisible_idx" ON "ExperienceHighlight"("isVisible");

-- CreateIndex
CREATE INDEX "ExperienceHighlight_createdAt_idx" ON "ExperienceHighlight"("createdAt");

-- CreateIndex
CREATE INDEX "ExperienceImage_experiencePageId_idx" ON "ExperienceImage"("experiencePageId");

-- CreateIndex
CREATE INDEX "ExperienceImage_sortOrder_idx" ON "ExperienceImage"("sortOrder");

-- CreateIndex
CREATE INDEX "ExperienceImage_isFeatured_idx" ON "ExperienceImage"("isFeatured");

-- CreateIndex
CREATE INDEX "ExperienceImage_isVisible_idx" ON "ExperienceImage"("isVisible");

-- CreateIndex
CREATE INDEX "ExperienceImage_createdAt_idx" ON "ExperienceImage"("createdAt");

-- AddForeignKey
ALTER TABLE "ExperienceHighlight" ADD CONSTRAINT "ExperienceHighlight_experiencePageId_fkey" FOREIGN KEY ("experiencePageId") REFERENCES "ExperiencePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceImage" ADD CONSTRAINT "ExperienceImage_experiencePageId_fkey" FOREIGN KEY ("experiencePageId") REFERENCES "ExperiencePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
