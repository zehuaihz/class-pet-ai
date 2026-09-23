/**
 * Concurrent check-in approval.
 *
 * The reward for a check-in record must be granted exactly once no matter how
 * many teachers hit "approve" at the same moment: one `PointTransaction` linked
 * to the record, one balance increment, one audit event.
 */
import { CheckinStatus } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import {
  approveCheckinRecord,
  rejectCheckinRecord,
  submitCheckinRecord,
} from "@/server/services/checkin-record.service"
import { AppError } from "@/server/utils/errors"
import { seedClassroomForTeacher } from "@/test/seeds/seed-classroom"
import { CONCURRENCY } from "./setup/integration-env"
import {
  describeError,
  expectAppError,
  expectBalanceMatchesLedger,
  isPrismaError,
  readPetGrowth,
  readStudentPoints,
  settleAll,
} from "./setup/harness"

const REWARD = 5

async function seedPendingCheckin() {
  const seeded = await seedClassroomForTeacher({
    teacher: { email: "checkin-concurrency@test.com", name: "打卡老师" },
    classroom: { name: "打卡班" },
    students: [{ name: "小明", totalPoints: 0 }],
    checkinTasks: [{ title: "每日阅读", rewardPoints: REWARD, requireEvidence: true }],
  })
  const [student] = seeded.students
  const [task] = seeded.checkinTasks
  const record = await submitCheckinRecord({
    studentId: student.id,
    taskId: task.id,
    evidenceUrl: "https://example.com/reading.png",
  })

  return { ...seeded, student, task, record }
}

describe("checkin approval concurrency", () => {
  it("grants the reward exactly once for N parallel approvals", async () => {
    const { teacher, classroom, student, record } = await seedPendingCheckin()
    expect(record.status).toBe(CheckinStatus.PENDING)

    const { fulfilled, rejected } = await settleAll(
      Array.from({ length: CONCURRENCY }, () => approveCheckinRecord(teacher.id, record.id)),
    )

    // Approval is idempotent: no racer may fail, and every racer must observe APPROVED.
    expect(rejected.map(describeError)).toEqual([])
    expect(fulfilled).toHaveLength(CONCURRENCY)
    for (const result of fulfilled) expect(result?.status).toBe(CheckinStatus.APPROVED)

    const rewardRows = await prisma.pointTransaction.findMany({ where: { checkinRecordId: record.id } })
    expect(rewardRows).toHaveLength(1)
    expect(rewardRows[0].delta).toBe(REWARD)
    expect(rewardRows[0].source).toBe("CHECKIN")

    expect(await readStudentPoints(student.id)).toBe(REWARD)
    expect(await expectBalanceMatchesLedger(student.id)).toBe(REWARD)

    expect(await readPetGrowth(classroom.id)).toBe(REWARD)
    expect(await prisma.petGrowthLog.count()).toBe(1)

    expect(await prisma.auditLog.count({ where: { action: "CHECKIN_APPROVED" } })).toBe(1)
    expect(await prisma.auditLog.count({ where: { action: "CHECKIN_SUBMITTED" } })).toBe(1)
  })

  it("does not re-award when an already approved record is approved again", async () => {
    const { teacher, student, record } = await seedPendingCheckin()

    await approveCheckinRecord(teacher.id, record.id)
    const again = await approveCheckinRecord(teacher.id, record.id)

    expect(again?.status).toBe(CheckinStatus.APPROVED)
    expect(await prisma.pointTransaction.count({ where: { checkinRecordId: record.id } })).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(REWARD)
  })

  it("awards points once for an auto-approved submission and never again on approval", async () => {
    const seeded = await seedClassroomForTeacher({
      teacher: { email: "checkin-auto@test.com", name: "自动打卡老师" },
      classroom: { name: "自动打卡班" },
      students: [{ name: "小红", totalPoints: 0 }],
      checkinTasks: [{ title: "每日运动", rewardPoints: REWARD, requireEvidence: false }],
    })
    const [student] = seeded.students
    const [task] = seeded.checkinTasks

    const record = await submitCheckinRecord({ studentId: student.id, taskId: task.id })
    expect(record.status).toBe(CheckinStatus.COMPLETED)
    expect(await readStudentPoints(student.id)).toBe(REWARD)

    const approved = await approveCheckinRecord(seeded.teacher.id, record.id)
    expect(approved?.status).toBe(CheckinStatus.COMPLETED)

    expect(await prisma.pointTransaction.count({ where: { checkinRecordId: record.id } })).toBe(1)
    expect(await readStudentPoints(student.id)).toBe(REWARD)
    expect(await expectBalanceMatchesLedger(student.id)).toBe(REWARD)
  })

  it("creates exactly one record for N parallel submissions of the same task", async () => {
    const seeded = await seedClassroomForTeacher({
      teacher: { email: "checkin-submit@test.com", name: "提交打卡老师" },
      classroom: { name: "提交打卡班" },
      students: [{ name: "小刚", totalPoints: 0 }],
      checkinTasks: [{ title: "每日阅读", rewardPoints: 0, requireEvidence: true }],
    })
    const [student] = seeded.students
    const [task] = seeded.checkinTasks

    const { fulfilled, rejected } = await settleAll(
      Array.from({ length: CONCURRENCY }, () =>
        submitCheckinRecord({ studentId: student.id, taskId: task.id, evidenceUrl: "https://example.com/a.png" }),
      ),
    )

    // Every loser - whether it lost the pre-check or the (taskId, studentId)
    // unique index - must surface as AppError(CONFLICT). A raw P2002 would be
    // reported to the client as a 500 instead of a 409.
    const unexpected = rejected.filter((error) => !(error instanceof AppError && error.code === "CONFLICT"))
    expect(unexpected.map(describeError)).toEqual([])
    expect(rejected.filter((error) => isPrismaError(error, "P2002"))).toEqual([])
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(CONCURRENCY - 1)
    expect(await prisma.checkinRecord.count({ where: { taskId: task.id, studentId: student.id } })).toBe(1)
  })

  it("approve and reject racing each other settle on a single terminal state", async () => {
    const { teacher, student, record } = await seedPendingCheckin()

    const race = await settleAll([
      approveCheckinRecord(teacher.id, record.id),
      rejectCheckinRecord(teacher.id, record.id),
    ])

    expect(race.rejected.map(describeError)).toEqual([])

    const stored = await prisma.checkinRecord.findUniqueOrThrow({ where: { id: record.id } })
    const rewardRows = await prisma.pointTransaction.count({ where: { checkinRecordId: record.id } })

    // Whichever handler won the row lock, the record ends in exactly one
    // terminal state and the reward matches it - never both.
    if (stored.status === CheckinStatus.APPROVED) {
      expect(rewardRows).toBe(1)
      expect(await readStudentPoints(student.id)).toBe(REWARD)
      expect(await prisma.auditLog.count({ where: { action: "CHECKIN_APPROVED" } })).toBe(1)
      expect(await prisma.auditLog.count({ where: { action: "CHECKIN_REJECTED" } })).toBe(0)
    } else {
      expect(stored.status).toBe(CheckinStatus.REJECTED)
      expect(rewardRows).toBe(0)
      expect(await readStudentPoints(student.id)).toBe(0)
      expect(await prisma.auditLog.count({ where: { action: "CHECKIN_REJECTED" } })).toBe(1)
      expect(await prisma.auditLog.count({ where: { action: "CHECKIN_APPROVED" } })).toBe(0)
    }
  })

  it("rejects approval from a teacher who does not own the classroom", async () => {
    const { record } = await seedPendingCheckin()
    const intruder = await seedClassroomForTeacher({
      teacher: { email: "checkin-intruder@test.com", name: "入侵者" },
      classroom: { name: "别人的班" },
    })

    await expectAppError(approveCheckinRecord(intruder.teacher.id, record.id), "FORBIDDEN", 403)
    expect(await prisma.pointTransaction.count()).toBe(0)
  })
})
