-- Import deduplication is private to each workspace.
DROP INDEX "Evidence_importKey_key";

-- DropIndex
DROP INDEX "Repository_path_key";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "OpenQuestion" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "StatusEvent" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Cv" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "CvRevision" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Suggestion" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "CoverLetter" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "ReviewRun" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "CvMessage" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- AlterTable
ALTER TABLE "ExportCheck" ADD COLUMN     "ownerId" TEXT NOT NULL DEFAULT 'unassigned';

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_ownerId_id_key" ON "Profile"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Source_ownerId_id_key" ON "Source"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_ownerId_importKey_key" ON "Evidence"("ownerId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_ownerId_id_key" ON "Evidence"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OpenQuestion_ownerId_id_key" ON "OpenQuestion"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Application_ownerId_id_key" ON "Application"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StatusEvent_ownerId_id_key" ON "StatusEvent"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Cv_ownerId_id_key" ON "Cv"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CvRevision_ownerId_id_key" ON "CvRevision"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_ownerId_id_key" ON "Suggestion"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_ownerId_id_key" ON "Assessment"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CoverLetter_ownerId_id_key" ON "CoverLetter"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRun_ownerId_id_key" ON "ReviewRun"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CvMessage_ownerId_id_key" ON "CvMessage"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_ownerId_path_key" ON "Repository"("ownerId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_ownerId_id_key" ON "Repository"("ownerId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ExportCheck_ownerId_id_key" ON "ExportCheck"("ownerId", "id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defense in depth: a record may only reference records in its own workspace.
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sourceId_workspace_fkey" FOREIGN KEY ("ownerId", "sourceId") REFERENCES "Source"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_evidenceId_workspace_fkey" FOREIGN KEY ("ownerId", "evidenceId") REFERENCES "Evidence"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Application" ADD CONSTRAINT "Application_submittedRevisionId_workspace_fkey" FOREIGN KEY ("ownerId", "submittedRevisionId") REFERENCES "CvRevision"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_applicationId_workspace_fkey" FOREIGN KEY ("ownerId", "applicationId") REFERENCES "Application"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_applicationId_workspace_fkey" FOREIGN KEY ("ownerId", "applicationId") REFERENCES "Application"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CvRevision" ADD CONSTRAINT "CvRevision_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_applicationId_workspace_fkey" FOREIGN KEY ("ownerId", "applicationId") REFERENCES "Application"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_coverLetterId_workspace_fkey" FOREIGN KEY ("ownerId", "coverLetterId") REFERENCES "CoverLetter"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CvMessage" ADD CONSTRAINT "CvMessage_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ExportCheck" ADD CONSTRAINT "ExportCheck_cvId_workspace_fkey" FOREIGN KEY ("ownerId", "cvId") REFERENCES "Cv"("ownerId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
