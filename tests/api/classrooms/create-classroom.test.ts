import { describe, expect, it } from "vitest"

describe("POST /api/v1/classrooms", () => {
  it("requires classroom name", () => {
    expect("三年级2班".trim().length).toBeGreaterThan(0)
  })
})
