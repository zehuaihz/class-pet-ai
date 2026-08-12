import type { AiProvider, CommentContext, ProviderResult } from "@/server/ai/ai-provider"
import { classifyHttpError, ProviderError } from "@/server/ai/ai-provider"

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"

export class AnthropicProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly timeoutMs = 30_000,
  ) {
    if (!apiKey) throw new ProviderError("ANTHROPIC_API_KEY not configured", "AUTH", false)
  }

  async generateCommentDraft(context: CommentContext, signal?: AbortSignal): Promise<ProviderResult> {
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    if (signal) signal.addEventListener("abort", () => controller.abort())

    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 512,
          system: "你是教师助手，根据学生表现生成简短、正面、可编辑的评语草稿。不要包含电话、邮箱或敏感个人信息。",
          messages: [{ role: "user", content: buildPrompt(context) }],
        }),
      })

      if (!response.ok) throw classifyHttpError(response.status)

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>
        usage?: { input_tokens?: number; output_tokens?: number }
        id?: string
      }
      const text = data.content?.find((block) => block.type === "text")?.text?.trim()
      if (!text) throw new ProviderError("empty provider response", "INVALID_REQUEST", false)

      return {
        text,
        provider: "anthropic",
        modelName: this.modelName,
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        providerRequestId: data.id,
        latencyMs: Date.now() - startedAt,
      }
    } catch (error: unknown) {
      if (error instanceof ProviderError) throw error
      if (error instanceof Error && error.name === "AbortError") throw new ProviderError("request timed out", "TIMEOUT", true)
      throw new ProviderError(error instanceof Error ? error.message : "network error", "NETWORK", true)
    } finally {
      clearTimeout(timeout)
    }
  }
}

function buildPrompt(context: CommentContext): string {
  return `学生姓名：${context.studentName}\n语气：${context.tone}\n当前积分：${context.totalPoints}\n近期成长：${context.recentGrowth}\n教师补充说明：${context.notes || "无"}\n请生成一段评语草稿。`
}
