import { describe, expect, it } from "vitest"

describe("GET /api/v1/me", () => {
  it("documents expected current user response", () => {
    expect({ role: "TEACHER", teacherProfile: { id: "tp_1" } }).toMatchObject({
      role: "TEACHER",
      teacherProfile: { id: expect.any(String) },
    })
  })
})
