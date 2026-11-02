CREATE TABLE IF NOT EXISTS "OpenQuestion" (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unsure',
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OpenQuestion_status_createdAt_idx"
ON "OpenQuestion" (status, "createdAt");

DO $$ BEGIN
    ALTER TABLE "OpenQuestion"
        ADD CONSTRAINT "OpenQuestion_evidenceId_fkey"
        FOREIGN KEY ("evidenceId") REFERENCES "Evidence"(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
