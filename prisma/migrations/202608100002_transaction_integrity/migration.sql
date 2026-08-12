-- AlterTable: PointTransaction integrity links
ALTER TABLE "PointTransaction" ADD COLUMN "reversalOfId"    TEXT;
ALTER TABLE "PointTransaction" ADD COLUMN "checkinRecordId" TEXT;
ALTER TABLE "PointTransaction" ADD COLUMN "redemptionId"    TEXT;
ALTER TABLE "PointTransaction" ADD COLUMN "idempotencyKey"  TEXT;

CREATE UNIQUE INDEX "PointTransaction_reversalOfId_key"    ON "PointTransaction"("reversalOfId");
CREATE UNIQUE INDEX "PointTransaction_checkinRecordId_key" ON "PointTransaction"("checkinRecordId");
CREATE UNIQUE INDEX "PointTransaction_redemptionId_key"    ON "PointTransaction"("redemptionId");
CREATE UNIQUE INDEX "PointTransaction_idempotencyKey_key"  ON "PointTransaction"("idempotencyKey");

-- AddForeignKey: self-reversal relation and links to CheckinRecord / RewardRedemption
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "PointTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_checkinRecordId_fkey"
  FOREIGN KEY ("checkinRecordId") REFERENCES "CheckinRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_redemptionId_fkey"
  FOREIGN KEY ("redemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill canonical reversal links from existing JSON metadata.
UPDATE "PointTransaction"
SET "reversalOfId" = ("meta"->>'reversedTransactionId')::text
WHERE "source" = 'ROLLBACK'
  AND "meta"->>'reversedTransactionId' IS NOT NULL
  AND "reversalOfId" IS NULL;
-- Keep only the earliest reversal per original; later duplicates remain unlinked by the unique constraint.
DELETE FROM "PointTransaction" a USING "PointTransaction" b
WHERE a."reversalOfId" = b."reversalOfId"
  AND a."reversalOfId" IS NOT NULL
  AND a."createdAt" > b."createdAt";

-- Backfill canonical check-in reward link from existing JSON metadata.
UPDATE "PointTransaction"
SET "checkinRecordId" = ("meta"->>'recordId')::text
WHERE "source" = 'CHECKIN'
  AND "meta"->>'recordId' IS NOT NULL
  AND "checkinRecordId" IS NULL;
DELETE FROM "PointTransaction" a USING "PointTransaction" b
WHERE a."checkinRecordId" = b."checkinRecordId"
  AND a."checkinRecordId" IS NOT NULL
  AND a."createdAt" > b."createdAt";

-- AlterTable: AiJob lifecycle and usage fields
ALTER TABLE "AiJob" ADD COLUMN "attemptCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiJob" ADD COLUMN "maxAttempts"   INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "AiJob" ADD COLUMN "availableAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AiJob" ADD COLUMN "startedAt"     TIMESTAMP(3);
ALTER TABLE "AiJob" ADD COLUMN "finishedAt"    TIMESTAMP(3);
ALTER TABLE "AiJob" ADD COLUMN "lockedAt"      TIMESTAMP(3);
ALTER TABLE "AiJob" ADD COLUMN "lastErrorCode" TEXT;
ALTER TABLE "AiJob" ADD COLUMN "inputTokens"   INTEGER;
ALTER TABLE "AiJob" ADD COLUMN "outputTokens"  INTEGER;
ALTER TABLE "AiJob" ADD COLUMN "latencyMs"     INTEGER;

-- AlterTable: User account status and session versioning
ALTER TABLE "User" ADD COLUMN "status"         TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: PasswordCredential
CREATE TABLE "PasswordCredential" (
    "id"           TEXT      NOT NULL,
    "userId"       TEXT      NOT NULL,
    "passwordHash" TEXT      NOT NULL,
    "passwordSalt" TEXT      NOT NULL,
    "requireReset" BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordCredential_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PasswordCredential_userId_idx" ON "PasswordCredential"("userId");
ALTER TABLE "PasswordCredential" ADD CONSTRAINT "PasswordCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ParentStudent
CREATE TABLE "ParentStudent" (
    "id"        TEXT      NOT NULL,
    "parentId"  TEXT      NOT NULL,
    "studentId" TEXT      NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");
CREATE INDEX "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
