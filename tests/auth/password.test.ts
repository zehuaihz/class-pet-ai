import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "@/server/auth/password"

describe("password hashing", () => {
  it("hashes and verifies a password", () => {
    const stored = hashPassword("correct horse battery staple")
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true)
    expect(verifyPassword("wrong", stored)).toBe(false)
  })

  it("produces unique salts", () => {
    expect(hashPassword("same").passwordSalt).not.toBe(hashPassword("same").passwordSalt)
  })
})
