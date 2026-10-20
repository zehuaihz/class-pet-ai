-- Class Zoo v1 (merged onto the ai_generate audit/idempotency baseline).
--
-- Replaces the single shared class pet with per-student pets, turns badges into
-- the store currency, and adds custom per-classroom growth thresholds. The
-- ai_generate durability work (requestFingerprint, idempotency keys, AuditLog,
-- conditional balance updates) is preserved; only the ledger link for point
-- redemptions is dropped because redemptions now spend badges directly.

-- Create new enums
CREATE TYPE "PetStatus" AS ENUM ('GROWING', 'GRADUATED');
CREATE TYPE "BadgeStatus" AS ENUM ('AVAILABLE', 'CONSUMED');

-- PetSpecies: built-in species catalog with per-level visuals.
CREATE TABLE "PetSpecies" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "category"    TEXT NOT NULL,
    "visualSlots" JSONB NOT NULL,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PetSpecies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PetSpecies_key_key" ON "PetSpecies"("key");
CREATE INDEX "PetSpecies_enabled_idx" ON "PetSpecies"("enabled");

-- StudentPet: one row per adoption generation; the service enforces a single
-- GROWING pet per student at any time.
CREATE TABLE "StudentPet" (
    "id"          TEXT NOT NULL,
    "studentId"   TEXT NOT NULL,
    "speciesKey"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "level"       INTEGER NOT NULL DEFAULT 1,
    "growthValue" INTEGER NOT NULL DEFAULT 0,
    "status"      "PetStatus" NOT NULL DEFAULT 'GROWING',
    "adoptionSeq" INTEGER NOT NULL DEFAULT 1,
    "graduatedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentPet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentPet_studentId_status_idx" ON "StudentPet"("studentId", "status");
ALTER TABLE "StudentPet" ADD CONSTRAINT "StudentPet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentPet" ADD CONSTRAINT "StudentPet_speciesKey_fkey" FOREIGN KEY ("speciesKey") REFERENCES "PetSpecies"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Badge: earned on graduation; badges are the store currency.
CREATE TABLE "Badge" (
    "id"                     TEXT NOT NULL,
    "studentId"              TEXT NOT NULL,
    "studentPetId"           TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "visualKey"              TEXT NOT NULL,
    "status"                 "BadgeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "earnedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt"             TIMESTAMP(3),
    "consumedByRedemptionId" TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Badge_studentPetId_key" ON "Badge"("studentPetId");
CREATE INDEX "Badge_studentId_status_idx" ON "Badge"("studentId", "status");
CREATE INDEX "Badge_consumedByRedemptionId_idx" ON "Badge"("consumedByRedemptionId");
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_studentPetId_fkey" FOREIGN KEY ("studentPetId") REFERENCES "StudentPet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_consumedByRedemptionId_fkey" FOREIGN KEY ("consumedByRedemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PetLevelConfig: per-classroom cumulative growth threshold for each level.
CREATE TABLE "PetLevelConfig" (
    "id"             TEXT NOT NULL,
    "classroomId"    TEXT NOT NULL,
    "level"          INTEGER NOT NULL,
    "requiredGrowth" INTEGER NOT NULL,
    CONSTRAINT "PetLevelConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PetLevelConfig_classroomId_level_key" ON "PetLevelConfig"("classroomId", "level");
ALTER TABLE "PetLevelConfig" ADD CONSTRAINT "PetLevelConfig_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SystemSetting: global key/value (e.g. system display name).
CREATE TABLE "SystemSetting" (
    "key"   TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- Repoint growth logs from the shared class pet to per-student pets.
-- Stale rows referencing the soon-to-be-dropped class pet are meaningless in
-- the zoo model, so they are removed before making the new column NOT NULL.
DELETE FROM "PetGrowthLog";
ALTER TABLE "PetGrowthLog" DROP CONSTRAINT "PetGrowthLog_petId_fkey";
DROP INDEX "PetGrowthLog_petId_createdAt_idx";
ALTER TABLE "PetGrowthLog" DROP COLUMN "petId";
ALTER TABLE "PetGrowthLog" ADD COLUMN "studentPetId" TEXT NOT NULL;
CREATE INDEX "PetGrowthLog_studentPetId_createdAt_idx" ON "PetGrowthLog"("studentPetId");
ALTER TABLE "PetGrowthLog" ADD CONSTRAINT "PetGrowthLog_studentPetId_fkey" FOREIGN KEY ("studentPetId") REFERENCES "StudentPet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old shared class pet and its mood enum.
DROP TABLE "Pet";
DROP TYPE "PetMood";

-- Redemption currency: points -> badges. Idempotency stays on the redemption
-- itself (idempotencyKey/requestFingerprint columns are already present from
-- the audit_reliability migration).
ALTER TABLE "RewardItem" RENAME COLUMN "costPoints" TO "costBadges";
ALTER TABLE "RewardRedemption" RENAME COLUMN "pointsSpent" TO "badgesSpent";

-- Redemptions no longer spend points, so drop the ledger link and add a batch
-- key for multi-student feeding. requestFingerprint/idempotencyKey survive.
ALTER TABLE "PointTransaction" DROP CONSTRAINT "PointTransaction_redemptionId_fkey";
DROP INDEX "PointTransaction_redemptionId_key";
ALTER TABLE "PointTransaction" DROP COLUMN "redemptionId";
ALTER TABLE "PointTransaction" ADD COLUMN "batchKey" TEXT;
CREATE INDEX "PointTransaction_batchKey_idx" ON "PointTransaction"("batchKey");
