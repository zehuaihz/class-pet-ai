import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { hashPassword } from "@/server/auth/password"

const dbMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  teacherProfileCreate: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: { findUnique: dbMocks.userFindUnique, findFirst: dbMocks.userFindFirst, create: dbMocks.userCreate },
    teacherProfile: { create: dbMocks.teacherProfileCreate },
  },
}))

import { authenticateAccount, authenticateTeacher } from "@/server/services/auth.service"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("authenticateTeacher", () => {
  beforeEach(() => {
    vi.stubEnv("TEACHER_LOGIN_EMAIL", "teacher@example.com")
    vi.stubEnv("TEACHER_LOGIN_PASSWORD", "password123")
  })

  it("rejects invalid credentials", async () => {
    await expect(
      authenticateTeacher({ identifier: "attacker@example.com", password: "password123" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(dbMocks.userFindUnique).not.toHaveBeenCalled()
  })

  it("creates teacher on first valid login", async () => {
    dbMocks.userFindUnique.mockResolvedValue(null)
    dbMocks.userCreate.mockResolvedValue({
      id: "user_1",
      role: "TEACHER",
      name: "张老师",
      teacherProfile: null,
    })
    dbMocks.teacherProfileCreate.mockResolvedValue({ id: "tp_1", schoolName: "测试小学" })

    const user = await authenticateTeacher({
      identifier: "teacher@example.com",
      password: "password123",
    })

    expect(user.id).toBe("user_1")
    expect(user.role).toBe("TEACHER")
    expect(user.teacherProfile?.id).toBe("tp_1")
  })
})

describe("authenticateAccount", () => {
  beforeEach(() => {
    vi.stubEnv("TEACHER_LOGIN_EMAIL", "teacher@example.com")
    vi.stubEnv("TEACHER_LOGIN_PASSWORD", "password123")
  })

  function dbUser(overrides: Record<string, unknown> = {}) {
    return {
      id: "admin_1",
      role: "ADMIN",
      name: "系统管理员",
      status: "ACTIVE",
      credentials: [{ ...hashPassword("secret123"), requireReset: false }],
      teacherProfile: null,
      studentAccount: null,
      children: [],
      ...overrides,
    }
  }

  it("authenticates a DB user by their own credentials", async () => {
    dbMocks.userFindFirst.mockResolvedValue(dbUser())

    const user = await authenticateAccount({ identifier: "admin@example.com", password: "secret123" })

    expect(user.role).toBe("ADMIN")
    expect(userFindFirstCalledWithActiveStatus()).toBe(true)
  })

  it("rejects a wrong password for an existing DB account without env fallback", async () => {
    dbMocks.userFindFirst.mockResolvedValue(dbUser())

    await expect(
      authenticateAccount({ identifier: "admin@example.com", password: "wrong-password" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(dbMocks.userFindUnique).not.toHaveBeenCalled()
  })

  it("rejects when the account requires a password reset", async () => {
    dbMocks.userFindFirst.mockResolvedValue(
      dbUser({ credentials: [{ ...hashPassword("secret123"), requireReset: true }] }),
    )

    await expect(
      authenticateAccount({ identifier: "admin@example.com", password: "secret123" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("falls back to env teacher credentials when the account is not in the DB", async () => {
    dbMocks.userFindFirst.mockResolvedValue(null)
    dbMocks.userFindUnique.mockResolvedValue(null)
    dbMocks.userCreate.mockResolvedValue({
      id: "user_1",
      role: "TEACHER",
      name: "张老师",
      teacherProfile: null,
    })
    dbMocks.teacherProfileCreate.mockResolvedValue({ id: "tp_1", schoolName: "测试小学" })

    const user = await authenticateAccount({ identifier: "teacher@example.com", password: "password123" })

    expect(user.role).toBe("TEACHER")
  })

  function userFindFirstCalledWithActiveStatus() {
    const call = dbMocks.userFindFirst.mock.calls[0]?.[0]
    return call?.where?.status === "ACTIVE"
  }
})
