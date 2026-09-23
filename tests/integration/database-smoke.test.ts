/**
 * Proves the integration harness is wired to a real PostgreSQL database:
 * a real connection, real writes through the real services, and a real
 * read-back (including through a second, independent connection).
 */
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import { createPointTransaction } from "@/server/services/point-transaction.service"
import { countTestDbRows } from "@/test/seeds/cleanup-test-db"
import { seedClassroomForTeacher } from "@/test/seeds/seed-classroom"
import { resolveTestDatabase } from "./setup/integration-env"
import { expectAppError, withFreshClient } from "./setup/harness"

const target = resolveTestDatabase()

describe("integration database smoke", () => {
  it("connects to the dedicated *_test database over a real PostgreSQL connection", async () => {
    const rows = await prisma.$queryRaw<Array<{ current_database: string; version: string }>>`
      SELECT current_database() AS current_database, version() AS version
    `

    expect(target.databaseName).toMatch(/_test$/)
    expect(rows).toHaveLength(1)
    expect(rows[0].current_database).toBe(target.databaseName)
    expect(rows[0].version).toContain("PostgreSQL")
  })

  it("persists a point transaction through the real service and reads it back from a separate connection", async () => {
    const { teacher, classroom, students } = await seedClassroomForTeacher({
      teacher: { email: "smoke-teacher@test.com", name: "冒烟老师" },
      classroom: { name: "冒烟班" },
      students: [{ name: "小明", totalPoints: 0 }],
    })
    const [student] = students

    const { transaction } = await createPointTransaction({
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      studentId: student.id,
      delta: 15,
      reason: "课堂表现优秀",
    })

    expect(transaction.id).toBeTruthy()

    // Same connection.
    const persisted = await prisma.pointTransaction.findUniqueOrThrow({ where: { id: transaction.id } })
    expect(persisted.delta).toBe(15)
    expect(persisted.classroomId).toBe(classroom.id)
    expect(persisted.studentId).toBe(student.id)
    expect(persisted.source).toBe("MANUAL")

    // Independent connection: the row is in PostgreSQL, not in client state.
    const fromSecondConnection = await withFreshClient((client) =>
      client.pointTransaction.findUniqueOrThrow({ where: { id: transaction.id } }),
    )
    expect(fromSecondConnection.id).toBe(transaction.id)
    expect(fromSecondConnection.delta).toBe(15)

    const updatedStudent = await prisma.student.findUniqueOrThrow({ where: { id: student.id } })
    expect(updatedStudent.totalPoints).toBe(15)

    const pet = await prisma.pet.findUniqueOrThrow({ where: { classroomId: classroom.id } })
    expect(pet.growthValue).toBe(15)

    const growthLogs = await prisma.petGrowthLog.findMany({ where: { pointTransactionId: transaction.id } })
    expect(growthLogs).toHaveLength(1)

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: transaction.id } })
    expect(auditRows.map((row) => row.action)).toContain("POINTS_GRANTED")
    expect(auditRows[0].classroomId).toBe(classroom.id)
  })

  it("starts each test from a fully cleaned schema", async () => {
    const counts = await countTestDbRows()

    for (const [table, count] of Object.entries(counts)) {
      expect(count, `expected "${table}" to be empty before this test`).toBe(0)
    }
  })

  it("leaves no partial write behind when a service call is rejected", async () => {
    const { teacher, classroom, students } = await seedClassroomForTeacher({
      teacher: { email: "smoke-teacher-2@test.com", name: "冒烟老师" },
      classroom: { name: "冒烟班2" },
      students: [{ name: "小红", totalPoints: 3 }],
    })
    const [student] = students

    await expectAppError(
      createPointTransaction({
        actorTeacherId: teacher.id,
        classroomId: classroom.id,
        studentId: student.id,
        delta: -10,
        reason: "扣分",
        requireSufficientBalance: true,
      }),
      "CONFLICT",
      409,
    )

    const counts = await countTestDbRows()
    expect(counts.pointTransaction).toBe(0)
    expect(counts.auditLog).toBe(0)
    expect(counts.petGrowthLog).toBe(0)

    const after = await prisma.student.findUniqueOrThrow({ where: { id: student.id } })
    expect(after.totalPoints).toBe(3)
  })
})
