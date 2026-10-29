-- Admin platform: schools, teacher school membership, and subscription
-- orders for operations ("how many copies sold"). Non-destructive addition;
-- idempotent for re-runs.

-- CreateTable
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "School_status_createdAt_idx" ON "School"("status", "createdAt" DESC);

-- AddColumn: link teachers to a school (optional, SET NULL on school delete)
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "teacherProfileId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'YEARLY',
    "seats" INT NOT NULL DEFAULT 1,
    "amountCents" INT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_status_createdAt_idx" ON "Subscription"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Subscription_schoolId_idx" ON "Subscription"("schoolId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherProfile_schoolId_fkey') THEN
        ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_schoolId_fkey') THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_teacherProfileId_fkey') THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
