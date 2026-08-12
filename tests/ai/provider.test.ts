import { describe, expect, it } from "vitest"
import { MockAiProvider } from "@/server/ai/mock.provider"
import { classifyHttpError } from "@/server/ai/ai-provider"

describe("AI provider", () => {
  it("mock provider returns a deterministic draft", async () => {
    const result = await new MockAiProvider().generateCommentDraft({
      studentName: "小明",
      tone: "鼓励",
      notes: "课堂积极",
      totalPoints: 120,
      recentGrowth: 30,
    })
    expect(result.provider).toBe("mock")
    expect(result.text).toContain("小明")
    expect(result.text).toContain("120")
  })

  it("classifies http errors into retryable codes", () => {
    expect(classifyHttpError(401).retryable).toBe(false)
    expect(classifyHttpError(429).retryable).toBe(true)
    expect(classifyHttpError(529).retryable).toBe(true)
    expect(classifyHttpError(500).retryable).toBe(true)
  })
})
