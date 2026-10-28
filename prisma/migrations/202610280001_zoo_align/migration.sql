-- Zoo alignment for databases upgraded from the August root-lineage zoo v1
-- (202608120001_zoo_v1): that migration added the zoo objects without dropping
-- the legacy class-pet ones. On a fresh database that already applied
-- 202610200001_zoo_v1 every statement below is a no-op.

-- Legacy growth logs from the old single-pet model have NULL studentPetId;
-- clear them before tightening the column (mirrors zoo_v1 semantics).
DELETE FROM "PetGrowthLog";

-- Detach legacy redemption linkage on point transactions (badges replaced it).
ALTER TABLE "PointTransaction" DROP CONSTRAINT IF EXISTS "PointTransaction_redemptionId_fkey";
ALTER TABLE "PointTransaction" DROP CONSTRAINT IF EXISTS "PointTransaction_redemptionId_key";
ALTER TABLE "PointTransaction" DROP COLUMN IF EXISTS "redemptionId";

-- Tighten studentPetId on growth logs and rebuild the merged index.
DROP INDEX IF EXISTS "PetGrowthLog_studentPetId_createdAt_idx";
ALTER TABLE "PetGrowthLog" ALTER COLUMN "studentPetId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PetGrowthLog_studentPetId_createdAt_idx" ON "PetGrowthLog"("studentPetId", "createdAt");

-- Drop legacy class-pet objects.
DROP TABLE IF EXISTS "Pet";
DROP TYPE IF EXISTS "PetMood";
