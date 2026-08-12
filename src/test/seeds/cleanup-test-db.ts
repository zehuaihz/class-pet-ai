import { prisma } from "@/server/db/prisma"

export async function cleanupTestDb() {
  await prisma.$transaction([
    prisma.aiJob.deleteMany(),
    prisma.rewardRedemption.deleteMany(),
    prisma.rewardItem.deleteMany(),
    prisma.petGrowthLog.deleteMany(),
    prisma.pointTransaction.deleteMany(),
    prisma.checkinRecord.deleteMany(),
    prisma.checkinTask.deleteMany(),
    prisma.pet.deleteMany(),
    prisma.pointRule.deleteMany(),
    prisma.student.deleteMany(),
    prisma.group.deleteMany(),
    prisma.classroom.deleteMany(),
    prisma.teacherProfile.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
