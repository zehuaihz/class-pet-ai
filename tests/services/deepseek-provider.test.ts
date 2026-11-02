import { afterEach, describe, expect, it, vi } from "vitest"
import { DeepSeekProvider } from "@/server/ai/deepseek.provider"
import { ProviderError } from "@/server/ai/ai-provider"

const CONTEXT = {
  studentName: "小桃",
  tone: "warm",
  notes: "主动帮助同学",
  totalPoints: 120,
  recentGrowth: 18,
}

function mockFetchOnce(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("DeepSeekProvider", () => {
  it("returns comment text and token usage on success", async () => {
    const fetchMock = mockFetchOnce({
      id: "chatcmpl-123",
      choices: [{ message: { content: "  小桃本学期进步显著……  " } }],
      usage: { prompt_tokens: 88, completion_tokens: 120 },
    })
    vi.stubGlobal("fetch", fetchMock)

    const provider = new DeepSeekProvider("sk-test", "deepseek-chat", 5_000)
    const result = await provider.generateCommentDraft(CONTEXT)

    expect(result.text).toBe("小桃本学期进步显著……")
    expect(result.provider).toBe("deepseek")
    expect(result.modelName).toBe("deepseek-chat")
    expect(result.inputTokens).toBe(88)
    expect(result.outputTokens).toBe(120)
    expect(result.providerRequestId).toBe("chatcmpl-123")

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.deepseek.com/chat/completions")
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer sk-test",
    })
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe("deepseek-chat")
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe("system")
    expect(body.messages[1].content).toContain("小桃")
  })

  it("maps 401 to non-retryable AUTH ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({ error: { message: "Authentication Fails" } }, 401),
    )

    const provider = new DeepSeekProvider("sk-bad", "deepseek-chat", 5_000)
    const error = await provider.generateCommentDraft(CONTEXT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProviderError)
    expect((error as ProviderError).code).toBe("AUTH")
    expect((error as ProviderError).retryable).toBe(false)
    expect((error as ProviderError).message).toBe("authentication failed")
  })

  it("maps 429 to retryable RATE_LIMIT ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({ error: { message: "Rate limit reached" } }, 429),
    )

    const provider = new DeepSeekProvider("sk-test", "deepseek-chat", 5_000)
    const error = await provider.generateCommentDraft(CONTEXT).catch((e: unknown) => e)

    expect((error as ProviderError).code).toBe("RATE_LIMIT")
    expect((error as ProviderError).retryable).toBe(true)
  })

  it("rejects empty choices with INVALID_REQUEST", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ id: "x", choices: [{ message: { content: "" } }] }))

    const provider = new DeepSeekProvider("sk-test", "deepseek-chat", 5_000)
    const error = await provider.generateCommentDraft(CONTEXT).catch((e: unknown) => e)

    expect((error as ProviderError).code).toBe("INVALID_REQUEST")
  })

  it("maps AbortError to retryable TIMEOUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    )

    const provider = new DeepSeekProvider("sk-test", "deepseek-chat", 5_000)
    const error = await provider.generateCommentDraft(CONTEXT).catch((e: unknown) => e)

    expect((error as ProviderError).code).toBe("TIMEOUT")
    expect((error as ProviderError).retryable).toBe(true)
  })
})
