import { describe, expect, it } from "vitest"
import { fail, ok } from "@/server/utils/response-envelope"

describe("response envelope", () => {
  it("wraps success payload", () => {
    const result = ok({ id: "1" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: "1" })
    expect(result.error).toBeNull()
    expect(result.meta).toBeNull()
  })

  it("wraps error payload", () => {
    const result = fail("FORBIDDEN", "No permission")

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error.code).toBe("FORBIDDEN")
    expect(result.error.message).toBe("No permission")
    expect(result.meta).toBeNull()
  })
})
