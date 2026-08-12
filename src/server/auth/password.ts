import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const KEY_LEN = 64

export interface PasswordHash {
  passwordHash: string
  passwordSalt: string
}

export function hashPassword(password: string): PasswordHash {
  const passwordSalt = randomBytes(16).toString("hex")
  const passwordHash = scryptSync(password, passwordSalt, KEY_LEN).toString("hex")
  return { passwordHash, passwordSalt }
}

export function verifyPassword(password: string, stored: PasswordHash): boolean {
  const hash = scryptSync(password, stored.passwordSalt, KEY_LEN)
  const expected = Buffer.from(stored.passwordHash, "hex")
  if (hash.length !== expected.length) return false
  return timingSafeEqual(hash, expected)
}
