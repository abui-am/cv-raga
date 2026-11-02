-- AlterTable
ALTER TABLE "ReviewRun" ADD COLUMN     "improvement" JSONB;

-- CreateTable
CREATE TABLE "CvMessage" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "cvRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CvMessage_cvId_createdAt_idx" ON "CvMessage"("cvId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_path_key" ON "Repository"("path");

-- AddForeignKey
ALTER TABLE "CvMessage" ADD CONSTRAINT "CvMessage_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;
