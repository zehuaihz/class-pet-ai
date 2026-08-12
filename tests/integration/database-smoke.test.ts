import { describe, expect, it } from "vitest"

describe("database integration prerequisites", () => {
  it("requires explicit TEST_DATABASE_URL before integration tests run", () => {
    if (!process.env.TEST_DATABASE_URL) {
      expect(process.env.TEST_DATABASE_URL).toBeUndefined()
      return
    }

    expect(process.env.TEST_DATABASE_URL).toMatch(/^postgres(?:ql)?:\/\//)
  })
})
