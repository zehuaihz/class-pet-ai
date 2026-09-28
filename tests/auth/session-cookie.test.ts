import { afterEach, describe, expect, it, vi } from "vitest"
import { isSecureRequest, setSessionCookie } from "@/server/auth/session"

afterEach(() => {
  vi.unstubAllEnvs()
})

function requestWith(headers: Record<string, string>, url = "http://example.test/api/v1/auth/login") {
  return new Request(url, { headers })
}

describe("session cookie Secure flag", () => {
  it("omits Secure for a plain HTTP request even in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    const cookie = setSessionCookie("token", isSecureRequest(requestWith({})))
    expect(cookie).not.toContain("Secure")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Lax")
  })

  it("adds Secure when the browser reached us over TLS", () => {
    vi.stubEnv("NODE_ENV", "production")
    const cookie = setSessionCookie("token", isSecureRequest(requestWith({}, "https://example.test/api/v1/auth/login")))
    expect(cookie).toContain("Secure")
  })

  it("trusts the proxy protocol header the reverse proxy sets", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(isSecureRequest(requestWith({ "x-forwarded-proto": "https" }))).toBe(true)
    expect(isSecureRequest(requestWith({ "x-forwarded-proto": "http" }))).toBe(false)
  })

  it("keeps the old production default when no request context is available", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(isSecureRequest()).toBe(true)
    vi.stubEnv("NODE_ENV", "development")
    expect(isSecureRequest()).toBe(false)
  })
})
