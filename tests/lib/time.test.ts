import { describe, expect, it } from "vitest"
import { formatAppTime, parseAppDateInput, startOfAppDay } from "@/lib/time"

describe("app time helpers", () => {
  it("formats timestamps in the app timezone", () => {
    expect(formatAppTime("2026-08-21T01:12:00.000Z")).toBe("09:12")
  })

  it("parses date input as app timezone midnight", () => {
    expect(parseAppDateInput("2026-08-21").toISOString()).toBe("2026-08-20T16:00:00.000Z")
  })

  it("returns start of app day for an instant", () => {
    expect(startOfAppDay("2026-08-21T01:12:00.000Z").toISOString()).toBe("2026-08-20T16:00:00.000Z")
  })
})
