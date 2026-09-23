/**
 * Database-level constraint and invariant coverage.
 *
 * These assertions are about what PostgreSQL itself guarantees (unique
 * indexes, foreign keys, cascades, SET NULL) plus the invariants the services
 * rely on those constraints to hold. No mocks: every call hits the real
 * database through real prisma clients.
 */
import { UserRole } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import { writeAuditLog, writeAuditLogInTx } from "@/server/services/audit-log.service"
import {
  createPointTransaction,
  createPointTransactionInTx,
  reversePointTransaction,
} from "@/server/services/point-transaction.service"
import { requestRedemption } from "@/server/services/redemption.service"
import { seedClassroomForTeacher, seedParentForStudent } from "@/test/seeds/seed-classroom"
import { expectAppError, expectBalanceMatchesLedger, expectPrismaError, readStudentPoints } from "./setup/harness"

async function seed(studentPoints = 0) {
  const seeded = await seedClassroomForTeacher({
    teacher: { email: "integrity-teacher@test.com", name: "完整性老师" },
    classroom: { name: "完整性班" },
    students: [{ name: "小明", totalPoints: studentPoints }],
    pointRules: [{ name: "举手回答", pointDelta: 2 }],
    rewardItems: [{ name: "铅笔", costPoints: 5, stock: 3 }],
    checkinTasks: [{ title: "每日阅读", rewardPoints: 4, requireEvidence: true }],
  })
  const [student] = seeded.students
  return { ...seeded, student }
}

describe("transaction integrity", () => {
  describe("unique indexes on the ledger", () => {
    it("allows only one point transaction per idempotency key", async () => {
      const { teacher, classroom, student } = await seed()

      await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 5,
        reason: "幂等奖励",
        idempotencyKey: "unique-key-1",
      })

      await expectPrismaError(
        prisma.pointTransaction.create({
          data: {
            classroomId: classroom.id,
            teacherId: teacher.id,
            studentId: student.id,
            delta: 5,
            reason: "重复写入",
            idempotencyKey: "unique-key-1",
          },
        }),
        "P2002",
      )

      expect(await prisma.pointTransaction.count({ where: { idempotencyKey: "unique-key-1" } })).toBe(1)
    })

    it("allows only one reversal per original transaction", async () => {
      const { teacher, classroom, student } = await seed()
      const { transaction: original } = await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 10,
        reason: "原始奖励",
      })

      await reversePointTransaction(teacher.id, original.id, "撤销：原始奖励")

      await expectPrismaError(
        prisma.pointTransaction.create({
          data: {
            classroomId: classroom.id,
            teacherId: teacher.id,
            studentId: student.id,
            delta: -10,
            reason: "重复撤销",
            source: "ROLLBACK",
            reversalOfId: original.id,
          },
        }),
        "P2002",
      )

      expect(await prisma.pointTransaction.count({ where: { reversalOfId: original.id } })).toBe(1)
      expect(await expectBalanceMatchesLedger(student.id)).toBe(0)
    })

    it("allows only one reward transaction per checkin record", async () => {
      const { teacher, classroom, student, checkinTasks } = await seed()
      const [task] = checkinTasks
      const record = await prisma.checkinRecord.create({
        data: { taskId: task.id, studentId: student.id, status: "PENDING" },
      })

      await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 4,
        reason: "打卡奖励",
        source: "CHECKIN",
        checkinRecordId: record.id,
      })

      await expectPrismaError(
        prisma.pointTransaction.create({
          data: {
            classroomId: classroom.id,
            teacherId: teacher.id,
            studentId: student.id,
            delta: 4,
            reason: "重复打卡奖励",
            source: "CHECKIN",
            checkinRecordId: record.id,
          },
        }),
        "P2002",
      )

      expect(await prisma.pointTransaction.count({ where: { checkinRecordId: record.id } })).toBe(1)
    })

    it("allows only one point transaction per redemption", async () => {
      const { classroom, student, rewardItems } = await seed(20)
      const redemption = await requestRedemption(student.id, rewardItems[0].id)

      await expectPrismaError(
        prisma.pointTransaction.create({
          data: {
            classroomId: classroom.id,
            teacherId: (await prisma.classroom.findUniqueOrThrow({ where: { id: classroom.id } })).teacherId,
            studentId: student.id,
            delta: -5,
            reason: "重复兑换扣分",
            source: "REWARD",
            redemptionId: redemption.id,
          },
        }),
        "P2002",
      )

      expect(await prisma.pointTransaction.count({ where: { redemptionId: redemption.id } })).toBe(1)
    })

    it("allows one pet and one checkin record per (task, student)", async () => {
      const { classroom, student, checkinTasks } = await seed()
      const [task] = checkinTasks

      await expectPrismaError(
        prisma.pet.create({ data: { classroomId: classroom.id, name: "第二只宠物", species: "cat" } }),
        "P2002",
      )

      await prisma.checkinRecord.create({ data: { taskId: task.id, studentId: student.id } })
      await expectPrismaError(
        prisma.checkinRecord.create({ data: { taskId: task.id, studentId: student.id } }),
        "P2002",
      )
    })
  })

  describe("foreign keys", () => {
    it("rejects a ledger row that references a missing classroom", async () => {
      const { teacher, classroom, student } = await seed()

      await expectPrismaError(
        prisma.pointTransaction.create({
          data: {
            classroomId: "classroom-that-does-not-exist",
            teacherId: teacher.id,
            studentId: student.id,
            delta: 1,
            reason: "幽灵班级",
          },
        }),
        "P2003",
      )

      expect(await prisma.pointTransaction.count({ where: { classroomId: classroom.id } })).toBe(0)
    })

    it("cascades a classroom delete and detaches its audit rows", async () => {
      const { teacher, classroom, student, checkinTasks, rewardItems } = await seed()
      const [task] = checkinTasks

      await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 6,
        reason: "级联测试",
      })
      await requestRedemption(student.id, rewardItems[0].id)
      await prisma.checkinRecord.create({ data: { taskId: task.id, studentId: student.id } })
      await prisma.group.create({ data: { classroomId: classroom.id, name: "第一组" } })
      const audit = await writeAuditLog({
        actorUserId: teacher.userId,
        classroomId: classroom.id,
        action: "CLASSROOM_DELETED_TEST",
        entityType: "Classroom",
        entityId: classroom.id,
      })

      await prisma.classroom.delete({ where: { id: classroom.id } })

      expect(await prisma.student.count({ where: { classroomId: classroom.id } })).toBe(0)
      expect(await prisma.pointTransaction.count({ where: { classroomId: classroom.id } })).toBe(0)
      expect(await prisma.pet.count({ where: { classroomId: classroom.id } })).toBe(0)
      expect(await prisma.petGrowthLog.count()).toBe(0)
      expect(await prisma.checkinRecord.count()).toBe(0)
      expect(await prisma.checkinTask.count()).toBe(0)
      expect(await prisma.rewardItem.count()).toBe(0)
      expect(await prisma.rewardRedemption.count()).toBe(0)
      expect(await prisma.group.count({ where: { classroomId: classroom.id } })).toBe(0)

      const detached = await prisma.auditLog.findUniqueOrThrow({ where: { id: audit.id } })
      expect(detached.classroomId).toBeNull()
      expect(detached.actorUserId).toBe(teacher.userId)
      expect(detached.entityId).toBe(classroom.id)
    })

    it("keeps ledger history but nulls the student link when a student is deleted", async () => {
      const { teacher, classroom, student } = await seed()
      const { transaction } = await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 8,
        reason: "历史保留",
      })

      await prisma.student.delete({ where: { id: student.id } })

      const survivor = await prisma.pointTransaction.findUniqueOrThrow({ where: { id: transaction.id } })
      expect(survivor.studentId).toBeNull()
      expect(survivor.delta).toBe(8)
      expect(survivor.classroomId).toBe(classroom.id)
    })

    it("cascades password credentials and parent links when their owner is deleted", async () => {
      const { teacherUser, students } = await seedClassroomForTeacher({
        teacher: { email: "credentials@test.com", name: "有密码的老师" },
        classroom: { name: "凭据班" },
        students: [{ name: "小明" }],
        passwordCredential: { password: "s3cret-password" },
      })
      const [student] = students
      const parent = await seedParentForStudent({ email: "parent@test.com", studentId: student.id })

      expect(await prisma.passwordCredential.count({ where: { userId: teacherUser.id } })).toBe(1)
      expect(await prisma.parentStudent.count({ where: { studentId: student.id } })).toBe(1)

      await prisma.user.delete({ where: { id: parent.id } })
      expect(await prisma.parentStudent.count()).toBe(0)

      await prisma.user.delete({ where: { id: teacherUser.id } })
      expect(await prisma.passwordCredential.count()).toBe(0)
      expect(await prisma.teacherProfile.count()).toBe(0)
      expect(await prisma.classroom.count()).toBe(0)
    })

    it("nulls the audit actor when the actor user is deleted but keeps the audit row", async () => {
      const actor = await prisma.user.create({
        data: { role: UserRole.ADMIN, name: "审计员", email: "auditor@test.com" },
      })
      const audit = await writeAuditLog({
        actorUserId: actor.id,
        action: "ADMIN_ACTION",
        entityType: "User",
        entityId: actor.id,
      })

      await prisma.user.delete({ where: { id: actor.id } })

      const survivor = await prisma.auditLog.findUniqueOrThrow({ where: { id: audit.id } })
      expect(survivor.actorUserId).toBeNull()
      expect(survivor.action).toBe("ADMIN_ACTION")
    })
  })

  describe("transactional atomicity", () => {
    it("rolls back every write when the surrounding transaction aborts", async () => {
      const { teacher, classroom, student } = await seed()

      await expect(
        prisma.$transaction(async (tx) => {
          await createPointTransactionInTx(tx, {
            actorTeacherId: teacher.id,
            classroomId: classroom.id,
            studentId: student.id,
            delta: 7,
            reason: "将被回滚的奖励",
          })
          throw new Error("boom")
        }),
      ).rejects.toThrow("boom")

      expect(await prisma.pointTransaction.count()).toBe(0)
      expect(await prisma.petGrowthLog.count()).toBe(0)
      expect(await prisma.auditLog.count()).toBe(0)
      expect(await readStudentPoints(student.id)).toBe(0)
      expect(await prisma.pet.findUniqueOrThrow({ where: { classroomId: classroom.id } })).toMatchObject({
        growthValue: 0,
      })
    })

    it("keeps the ledger append-only: reversals never rewrite the original", async () => {
      const { teacher, classroom, student } = await seed()
      const { transaction: original } = await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 12,
        reason: "追加式账本",
      })

      await reversePointTransaction(teacher.id, original.id, "撤销：追加式账本")

      const untouched = await prisma.pointTransaction.findUniqueOrThrow({ where: { id: original.id } })
      expect(untouched.delta).toBe(12)
      expect(untouched.reversalOfId).toBeNull()

      const reversal = await prisma.pointTransaction.findUniqueOrThrow({ where: { reversalOfId: original.id } })
      expect(reversal.delta).toBe(-12)
      expect(reversal.source).toBe("ROLLBACK")
      expect(await expectBalanceMatchesLedger(student.id)).toBe(0)
    })

    it("refuses a second reversal of the same transaction", async () => {
      const { teacher, classroom, student } = await seed()
      const { transaction: original } = await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 9,
        reason: "只可撤销一次",
      })

      await reversePointTransaction(teacher.id, original.id, "撤销：只可撤销一次")
      const again = await reversePointTransaction(teacher.id, original.id, "撤销：只可撤销一次")

      expect(await prisma.pointTransaction.count({ where: { reversalOfId: original.id } })).toBe(1)
      expect(again.transaction.reversalOfId).toBe(original.id)
      expect(await readStudentPoints(student.id)).toBe(0)

      await expectAppError(reversePointTransaction(teacher.id, again.transaction.id, "撤销撤销"), "CONFLICT", 409)
    })
  })

  describe("service-level validation", () => {
    it("rejects a transaction with no target, two targets, or a blank reason", async () => {
      const { teacher, classroom, student } = await seed()
      const base = {
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        delta: 3,
        reason: "校验",
      }

      await expectAppError(createPointTransaction({ ...base }), "VALIDATION_ERROR", 422)
      await expectAppError(
        createPointTransaction({ ...base, studentId: student.id, groupId: "group-1" }),
        "VALIDATION_ERROR",
        422,
      )
      await expectAppError(createPointTransaction({ ...base, studentId: student.id, reason: "   " }), "VALIDATION_ERROR", 422)

      expect(await prisma.pointTransaction.count()).toBe(0)
    })

    it("rejects a disabled or unknown point rule", async () => {
      const { teacher, classroom, student, pointRules } = await seed()
      const [rule] = pointRules
      await prisma.pointRule.update({ where: { id: rule.id }, data: { enabled: false } })

      await expectAppError(
        createPointTransaction({
          actorTeacherId: teacher.id,
          classroomId: classroom.id,
          studentId: student.id,
          ruleId: rule.id,
          delta: 2,
          reason: "禁用规则",
        }),
        "NOT_FOUND",
        404,
      )
      await expectAppError(
        createPointTransaction({
          actorTeacherId: teacher.id,
          classroomId: classroom.id,
          studentId: student.id,
          ruleId: "missing-rule",
          delta: 2,
          reason: "未知规则",
        }),
        "NOT_FOUND",
        404,
      )
    })

    it("rejects a point transaction for a student in another classroom", async () => {
      const first = await seed()
      const second = await seedClassroomForTeacher({
        teacher: { email: "integrity-teacher-2@test.com", name: "另一位老师" },
        classroom: { name: "另一个班" },
        students: [{ name: "外班学生" }],
      })

      await expectAppError(
        createPointTransaction({
          actorTeacherId: first.teacher.id,
          classroomId: first.classroom.id,
          studentId: second.students[0].id,
          delta: 5,
          reason: "跨班写入",
        }),
        "NOT_FOUND",
        404,
      )
      expect(await prisma.pointTransaction.count()).toBe(0)
    })

    it("rejects a teacher acting on a classroom they do not own", async () => {
      const owner = await seed()
      const intruder = await seedClassroomForTeacher({
        teacher: { email: "intruder@test.com", name: "入侵者" },
        classroom: { name: "别人的班" },
        students: [{ name: "别人的学生" }],
      })

      await expectAppError(
        createPointTransaction({
          actorTeacherId: intruder.teacher.id,
          classroomId: owner.classroom.id,
          studentId: owner.student.id,
          delta: 5,
          reason: "越权写入",
        }),
        "FORBIDDEN",
        403,
      )
    })
  })

  describe("audit log durability", () => {
    it("redacts sensitive metadata but keeps the operational fields", async () => {
      const { teacher, classroom } = await seed()

      const audit = await prisma.$transaction((tx) =>
        writeAuditLogInTx(tx, {
          actorUserId: teacher.userId,
          classroomId: classroom.id,
          action: "SENSITIVE_WRITE",
          entityType: "PointTransaction",
          entityId: "tx-1",
          metadata: {
            delta: 5,
            password: "hunter2",
            passwordHash: "deadbeef",
            email: "student@example.com",
            evidenceUrl: "https://example.com/proof.png",
            nested: { token: "secret-token", studentId: "student-1" },
          },
        }),
      )

      const stored = await prisma.auditLog.findUniqueOrThrow({ where: { id: audit.id } })
      const metadata = stored.metadata as Record<string, unknown>

      expect(metadata.delta).toBe(5)
      expect(metadata.password).toBe("[redacted]")
      expect(metadata.passwordHash).toBe("[redacted]")
      expect(metadata.email).toBe("[redacted]")
      expect(metadata.evidenceUrl).toBe("[redacted]")
      expect(metadata.nested).toMatchObject({ token: "[redacted]", studentId: "student-1" })
      expect(stored.requestId).toBeNull()
    })

    it("persists one audit row per service mutation", async () => {
      const { teacher, classroom, student, rewardItems } = await seed()

      await createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: 20,
        reason: "审计奖励",
      })
      const redemption = await requestRedemption(student.id, rewardItems[0].id)

      const actions = (await prisma.auditLog.findMany()).map((row) => row.action)
      expect(actions.sort()).toEqual(["POINTS_GRANTED", "REDEMPTION_REQUESTED"])

      const redemptionAudit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: "RewardRedemption", entityId: redemption.id },
      })
      expect(redemptionAudit.classroomId).toBe(classroom.id)
      expect(redemptionAudit.metadata).toMatchObject({ rewardItemId: rewardItems[0].id, pointsSpent: 5 })
    })
  })
})
