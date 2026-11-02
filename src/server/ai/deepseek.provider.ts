import type { AiProvider, CommentContext, ProviderResult } from "@/server/ai/ai-provider"
import { classifyHttpError, ProviderError } from "@/server/ai/ai-provider"

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

const SYSTEM_PROMPT = [
  "你是一位经验丰富的小学班主任，擅长根据学生的课堂表现数据撰写评语。",
  "要求：简练、真挚、具体，面向家长可读；直接输出评语正文，不要标题、编号或额外说明。",
].join("")

export class DeepSeekProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly timeoutMs = 30_000,
  ) {
    if (!apiKey) throw new ProviderError("DEEPSEEK_API_KEY not configured", "AUTH", false)
  }

  async generateCommentDraft(context: CommentContext, signal?: AbortSignal): Promise<ProviderResult> {
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    if (signal) signal.addEventListener("abort", () => controller.abort())

    try {
      const response = await fetch(DEEPSEEK_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 512,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(context) },
          ],
        }),
      })

      if (!response.ok) throw classifyHttpError(response.status)

      const data = (await response.json()) as {
        id?: string
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      const text = data.choices?.[0]?.message?.content?.trim()
      if (!text) throw new ProviderError("empty provider response", "INVALID_REQUEST", false)

      return {
        text,
        provider: "deepseek",
        modelName: this.modelName,
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
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
