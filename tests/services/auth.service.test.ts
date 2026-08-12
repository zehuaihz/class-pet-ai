import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  teacherProfileCreate: vi.fn(),
}))

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: { findUnique: dbMocks.userFindUnique, create: dbMocks.userCreate },
    teacherProfile: { create: dbMocks.teacherProfileCreate },
  },
}))

import { authenticateTeacher } from "@/server/services/auth.service"

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
