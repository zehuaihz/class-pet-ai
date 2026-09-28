-- Add durable audit events and idempotent/reclaimable backend state.
--
-- Every statement is guarded so this migration also applies to databases that
-- were previously synced with `prisma db push` and already carry some of these
-- columns (the columns existed but were never recorded as a migration).
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "classroomId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PointTransaction" ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;
ALTER TABLE "AiJob" ADD COLUMN IF NOT EXISTS "claimToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "RewardRedemption_idempotencyKey_key" ON "RewardRedemption"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AiJob_claimToken_key" ON "AiJob"("claimToken");
CREATE INDEX IF NOT EXISTS "AuditLog_classroomId_createdAt_idx" ON "AuditLog"("classroomId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actorUserId_fkey') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
            FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_classroomId_fkey') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_classroomId_fkey"
            FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
