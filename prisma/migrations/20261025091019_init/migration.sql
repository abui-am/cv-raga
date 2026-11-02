-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Saved', 'Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT[],
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "posting" TEXT NOT NULL,
    "postingRevision" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "requirements" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'Saved',
    "appliedDate" TEXT NOT NULL,
    "nextActionDate" TEXT NOT NULL,
    "submittedRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cv" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'ats-classic-v1',
    "applicationId" TEXT,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "profileRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvRevision" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "postingRevision" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "proposed" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "cvRevision" INTEGER NOT NULL,
    "applicationId" TEXT NOT NULL,
    "postingRevision" INTEGER NOT NULL,
    "rubric" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_confirmed_updatedAt_idx" ON "Evidence"("confirmed", "updatedAt");

-- CreateIndex
CREATE INDEX "Evidence_sourceId_idx" ON "Evidence"("sourceId");

-- CreateIndex
CREATE INDEX "Application_status_updatedAt_idx" ON "Application"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Application_submittedRevisionId_idx" ON "Application"("submittedRevisionId");

-- CreateIndex
CREATE INDEX "StatusEvent_applicationId_createdAt_idx" ON "StatusEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Cv_applicationId_updatedAt_idx" ON "Cv"("applicationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CvRevision_cvId_number_key" ON "CvRevision"("cvId", "number");

-- CreateIndex
CREATE INDEX "Suggestion_cvId_createdAt_idx" ON "Suggestion"("cvId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_cvId_cvRevision_postingRevision_rubric_idx" ON "Assessment"("cvId", "cvRevision", "postingRevision", "rubric");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_submittedRevisionId_fkey" FOREIGN KEY ("submittedRevisionId") REFERENCES "CvRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvRevision" ADD CONSTRAINT "CvRevision_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;
