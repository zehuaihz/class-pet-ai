import { AnthropicProvider } from "@/server/ai/anthropic.provider"
import { DeepSeekProvider } from "@/server/ai/deepseek.provider"
import { MockAiProvider } from "@/server/ai/mock.provider"
import type { AiProvider } from "@/server/ai/ai-provider"

let cached: AiProvider | null = null

export function getAiProvider(): AiProvider {
  if (cached) return cached
  const providerName = (process.env.AI_PROVIDER ?? "mock").toLowerCase()
  if (providerName === "anthropic") {
    // `||` 而非 `??`：compose 透传空串时也要回退默认值。
    cached = new AnthropicProvider(
      process.env.ANTHROPIC_API_KEY ?? process.env.AI_API_KEY ?? "",
      process.env.AI_MODEL || "claude-sonnet-4-5",
      Number(process.env.AI_TIMEOUT_MS || 30_000),
    )
  } else if (providerName === "deepseek") {
    cached = new DeepSeekProvider(
      process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY ?? "",
      process.env.AI_MODEL || "deepseek-chat",
      Number(process.env.AI_TIMEOUT_MS || 30_000),
    )
  } else {
    cached = new MockAiProvider(process.env.AI_MODEL ?? "mock-model")
  }
  return cached
}

export function resetAiProviderCache() {
  cached = null
}
