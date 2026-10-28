import { prisma } from "@/server/db/prisma"

/**
 * FK-safe deletion order for the whole schema.
 *
 * Children before parents, and every table that holds a `SET NULL` reference
 * to another table is deleted before that table so the suite never leaves
 * orphaned rows behind (e.g. an `AuditLog` whose `classroomId` was silently
 * nulled by a classroom delete).
 *
 * Order rationale:
 *  - AuditLog            -> User, Classroom (SET NULL)
 *  - Badge               -> Student, StudentPet (CASCADE), RewardRedemption (SET NULL)
 *  - PetGrowthLog        -> StudentPet, PointTransaction (CASCADE)
 *  - PointTransaction    -> CheckinRecord / Student / Group / TeacherProfile
 *  - RewardRedemption    -> RewardItem, Student, TeacherProfile
 *  - CheckinRecord       -> CheckinTask, Student, TeacherProfile
 *  - StudentPet          -> Student (CASCADE); must go before PetSpecies (RESTRICT)
 *  - ParentStudent       -> User, Student
 *  - Student             -> Classroom, Group, User
 *  - PetSpecies          -> StudentPet (RESTRICT)
 *  - PetLevelConfig      -> Classroom
 *  - Classroom           -> TeacherProfile
 *  - PasswordCredential  -> User
 */
export const TEST_DB_DELETE_ORDER = [
  "aiJob",
  "auditLog",
  "badge",
  "petGrowthLog",
  "pointTransaction",
  "rewardRedemption",
  "rewardItem",
  "checkinRecord",
  "checkinTask",
  "studentPet",
  "pointRule",
  "parentStudent",
  "student",
  "group",
  "petSpecies",
  "petLevelConfig",
  "classroom",
  "passwordCredential",
  "teacherProfile",
  "user",
  "systemSetting",
] as const

export type TestDbTable = (typeof TEST_DB_DELETE_ORDER)[number]

/**
 * Deletes every row from every table in FK-safe order.
 *
 * Runs inside a single transaction so a partially cleaned database can never be
 * observed by the test that follows.
 */
export async function cleanupTestDb(): Promise<void> {
  await prisma.$transaction([
    prisma.aiJob.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.badge.deleteMany(),
    prisma.petGrowthLog.deleteMany(),
    prisma.pointTransaction.deleteMany(),
    prisma.rewardRedemption.deleteMany(),
    prisma.rewardItem.deleteMany(),
    prisma.checkinRecord.deleteMany(),
    prisma.checkinTask.deleteMany(),
    prisma.studentPet.deleteMany(),
    prisma.pointRule.deleteMany(),
    prisma.parentStudent.deleteMany(),
    prisma.student.deleteMany(),
    prisma.group.deleteMany(),
    prisma.petSpecies.deleteMany(),
    prisma.petLevelConfig.deleteMany(),
    prisma.classroom.deleteMany(),
    prisma.passwordCredential.deleteMany(),
    prisma.teacherProfile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.systemSetting.deleteMany(),
  ])
}

/** Row counts for every table, used to assert the harness really cleaned up. */
export async function countTestDbRows(): Promise<Record<TestDbTable, number>> {
  const [
    aiJob,
    auditLog,
    badge,
    petGrowthLog,
    pointTransaction,
    rewardRedemption,
    rewardItem,
    checkinRecord,
    checkinTask,
    studentPet,
    pointRule,
    parentStudent,
    student,
    group,
    petSpecies,
    petLevelConfig,
    classroom,
    passwordCredential,
    teacherProfile,
    user,
    systemSetting,
  ] = await Promise.all([
    prisma.aiJob.count(),
    prisma.auditLog.count(),
    prisma.badge.count(),
    prisma.petGrowthLog.count(),
    prisma.pointTransaction.count(),
    prisma.rewardRedemption.count(),
    prisma.rewardItem.count(),
    prisma.checkinRecord.count(),
    prisma.checkinTask.count(),
    prisma.studentPet.count(),
    prisma.pointRule.count(),
    prisma.parentStudent.count(),
    prisma.student.count(),
    prisma.group.count(),
    prisma.petSpecies.count(),
    prisma.petLevelConfig.count(),
    prisma.classroom.count(),
    prisma.passwordCredential.count(),
    prisma.teacherProfile.count(),
    prisma.user.count(),
    prisma.systemSetting.count(),
  ])

  return {
    aiJob,
    auditLog,
    badge,
    petGrowthLog,
    pointTransaction,
    rewardRedemption,
    rewardItem,
    checkinRecord,
    checkinTask,
    studentPet,
    pointRule,
    parentStudent,
    student,
    group,
    petSpecies,
    petLevelConfig,
    classroom,
    passwordCredential,
    teacherProfile,
    user,
    systemSetting,
  }
}
