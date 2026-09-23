/**
 * Anchors the 小组总积分 definition against a real database:
 * group total = sum of active member balances + group-level ledger awards.
 */
import { describe, expect, it } from "vitest"
import { prisma } from "@/server/db/prisma"
import { createPointTransaction } from "@/server/services/point-transaction.service"
import { getGroupPointTotals } from "@/server/services/group-points.service"
import { seedClassroomForTeacher } from "@/test/seeds/seed-classroom"

describe("group point totals", () => {
  it("sums active member balances and adds group-level awards", async () => {
    const { teacher, classroom, groups } = await seedClassroomForTeacher({
      teacher: { email: "group-total-teacher@test.com", name: "小组老师" },
      classroom: { name: "小组口径班" },
      groups: [{ name: "第一组" }, { name: "第二组" }],
      students: [
        { name: "甲", totalPoints: 128, groupName: "第一组" },
        { name: "乙", totalPoints: 96, groupName: "第一组" },
        { name: "丙", totalPoints: 75, groupName: "第二组" },
      ],
    })

    const [firstGroup] = groups
    const groupAward = await createPointTransaction({
      actorTeacherId: teacher.id,
      classroomId: classroom.id,
      groupId: firstGroup.id,
      delta: 10,
      reason: "小组合作加分",
    })
    expect(groupAward.groupTotalPoints).toBe(10)

    const totals = await getGroupPointTotals(classroom.id)
    const first = totals.find((total) => total.groupId === firstGroup.id)

    expect(first).toBeDefined()
    expect(first?.memberPoints).toBe(224) // 128 + 96
    expect(first?.groupBonusPoints).toBe(10)
    expect(first?.totalPoints).toBe(234)

    // The denormalised Group row still tracks only the group-level ledger.
    const stored = await prisma.group.findUniqueOrThrow({ where: { id: firstGroup.id } })
    expect(stored.totalPoints).toBe(10)
  })

  it("excludes inactive members and reported totals stay consistent across members", async () => {
    const { teacher, classroom, groups } = await seedClassroomForTeacher({
      teacher: { email: "group-inactive-teacher@test.com", name: "小组老师2" },
      classroom: { name: "小组口径班2" },
      groups: [{ name: "唯一组" }],
      students: [
        { name: "在职", totalPoints: 40, groupName: "唯一组" },
        { name: "休学", totalPoints: 999, status: "INACTIVE", groupName: "唯一组" },
      ],
    })

    expect(teacher.id).toBeTruthy()
    const [group] = groups
    const totals = await getGroupPointTotals(classroom.id)
    const only = totals.find((total) => total.groupId === group.id)

    expect(only?.memberPoints).toBe(40)
    expect(only?.totalPoints).toBe(40)
  })
})
