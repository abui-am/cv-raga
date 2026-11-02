-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "workMode" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "cvRevision" INTEGER NOT NULL,
    "postingRevision" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "evidenceQuotes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRun" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "cvRevision" INTEGER NOT NULL,
    "postingRevision" INTEGER NOT NULL,
    "coverLetterId" TEXT,
    "rubric" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoverLetter_cvId_number_key" ON "CoverLetter"("cvId", "number");

-- CreateIndex
CREATE INDEX "ReviewRun_cvId_cvRevision_postingRevision_createdAt_idx" ON "ReviewRun"("cvId", "cvRevision", "postingRevision", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRun_coverLetterId_idx" ON "ReviewRun"("coverLetterId");

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "CoverLetter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
