-- Student comment archive: teacher-confirmed comments persisted after AI
-- draft editing. Non-destructive addition; idempotent for re-runs.

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentComment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherProfileId" TEXT,
    "content" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT '鼓励',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentComment_classroomId_createdAt_idx" ON "StudentComment"("classroomId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "StudentComment_studentId_createdAt_idx" ON "StudentComment"("studentId", "createdAt" DESC);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentComment_classroomId_fkey') THEN
        ALTER TABLE "StudentComment" ADD CONSTRAINT "StudentComment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentComment_studentId_fkey') THEN
        ALTER TABLE "StudentComment" ADD CONSTRAINT "StudentComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
