import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  prisma: {
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    passwordCredential: { create: vi.fn() },
    teacherProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    school: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    classroom: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    student: { count: vi.fn() },
    subscription: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    pointTransaction: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock("@/server/auth/session", () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    ...mocks.prisma,
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        user: mocks.prisma.user,
        passwordCredential: mocks.prisma.passwordCredential,
        teacherProfile: mocks.prisma.teacherProfile,
        auditLog: mocks.prisma.auditLog,
      }),
    ),
  },
}))

import { POST as createTeacher } from "@/app/api/v1/admin/teachers/route"
import { GET as listSchoolsRoute, POST as createSchoolRoute } from "@/app/api/v1/admin/schools/route"
import { PATCH as updateSchoolRoute } from "@/app/api/v1/admin/schools/[schoolId]/route"
import { GET as statsRoute } from "@/app/api/v1/admin/stats/route"
import { POST as createOrderRoute } from "@/app/api/v1/admin/subscriptions/route"

function jsonRequest(body: unknown) {
  return new Request("http://test.local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("admin platform API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" })
  })

  it("creates a teacher account with credential, profile and audit log", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(null)
    mocks.prisma.school.findUnique.mockResolvedValue({ id: "school_1", name: "测试小学" })
    mocks.prisma.user.create.mockResolvedValue({ id: "user_2", name: "李老师", email: "li@example.com", role: "TEACHER", status: "ACTIVE" })
    mocks.prisma.teacherProfile.create.mockResolvedValue({ id: "profile_2", userId: "user_2" })

    const response = await createTeacher(jsonRequest({
      name: "李老师",
      email: "li@example.com",
      password: "initial-password-123",
      schoolId: "school_1",
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.email).toBe("li@example.com")
    expect(payload.data.schoolName).toBe("测试小学")
    expect(mocks.prisma.passwordCredential.create).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "ADMIN_CREATE_TEACHER" }) }),
    )
  })

  it("rejects duplicate teacher email with 409", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({ id: "existing" })

    const response = await createTeacher(jsonRequest({
      name: "李老师",
      email: "taken@example.com",
      password: "initial-password-123",
    }) as never)

    expect(response.status).toBe(409)
  })

  it("creates and lists schools", async () => {
    mocks.prisma.school.create.mockResolvedValue({ id: "school_2", name: "阳光小学", status: "ACTIVE" })

    const created = await createSchoolRoute(jsonRequest({ name: "阳光小学" }) as never)
    expect(created.status).toBe(201)

    mocks.prisma.school.findMany.mockResolvedValue([
      {
        id: "school_2",
        name: "阳光小学",
        status: "ACTIVE",
        contactName: null,
        contactPhone: null,
        createdAt: new Date("2026-10-01"),
        _count: { teachers: 3, subscriptions: 2 },
      },
    ])
    const listed = await listSchoolsRoute()
    const payload = await listed.json()
    expect(listed.status).toBe(200)
    expect(payload.data.items[0].teacherCount).toBe(3)
  })

  it("returns 404 when updating a missing school", async () => {
    mocks.prisma.school.findUnique.mockResolvedValue(null)

    const response = await updateSchoolRoute(jsonRequest({ status: "SUSPENDED" }) as never, {
      params: Promise.resolve({ schoolId: "missing" }),
    })

    expect(response.status).toBe(404)
  })

  it("aggregates platform stats and monthly sales", async () => {
    mocks.prisma.school.count.mockImplementation(async (args?: { where?: { status?: string } }) =>
      args?.where?.status === "ACTIVE" ? 1 : 2)
    mocks.prisma.user.count.mockResolvedValue(3)
    mocks.prisma.classroom.count.mockResolvedValue(4)
    mocks.prisma.student.count.mockResolvedValue(40)
    mocks.prisma.subscription.findMany.mockResolvedValue([
      { seats: 5, amountCents: 198000, createdAt: new Date("2026-10-05") },
      { seats: 2, amountCents: 39600, createdAt: new Date("2026-09-01") },
    ])
    mocks.prisma.pointTransaction.findMany.mockResolvedValue([{ studentId: "a" }, { studentId: "b" }])

    const response = await statsRoute()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.counts.schools).toBe(2)
    expect(payload.data.counts.activeSchools).toBe(1)
    expect(payload.data.sales.paidOrders).toBe(2)
    expect(payload.data.sales.totalSeats).toBe(7)
    expect(payload.data.sales.totalAmountCents).toBe(237600)
    expect(payload.data.sales.monthly).toHaveLength(6)
    expect(payload.data.counts.activeStudents30d).toBe(2)
  })

  it("rejects a subscription order without school or teacher", async () => {
    const response = await createOrderRoute(jsonRequest({ plan: "YEARLY", seats: 1, amountCents: 100 }) as never)
    expect(response.status).toBe(422)
  })

  it("creates a subscription order for a school", async () => {
    mocks.prisma.school.findUnique.mockResolvedValue({ id: "school_1", name: "测试小学" })
    mocks.prisma.subscription.create.mockResolvedValue({ id: "order_1", seats: 5 })

    const response = await createOrderRoute(jsonRequest({
      schoolId: "school_1",
      plan: "YEARLY",
      seats: 5,
      amountCents: 198000,
      status: "PAID",
    }) as never)

    expect(response.status).toBe(201)
    expect(mocks.prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ seats: 5, amountCents: 198000 }) }),
    )
  })
})
