import { AnthropicProvider } from "@/server/ai/anthropic.provider"
import { MockAiProvider } from "@/server/ai/mock.provider"
import type { AiProvider } from "@/server/ai/ai-provider"

let cached: AiProvider | null = null

export function getAiProvider(): AiProvider {
  if (cached) return cached
  const providerName = (process.env.AI_PROVIDER ?? "mock").toLowerCase()
  if (providerName === "anthropic") {
    cached = new AnthropicProvider(
      process.env.ANTHROPIC_API_KEY ?? process.env.AI_API_KEY ?? "",
      process.env.AI_MODEL ?? "claude-opus-4-8",
      Number(process.env.AI_TIMEOUT_MS ?? 30_000),
    )
  } else {
    cached = new MockAiProvider(process.env.AI_MODEL ?? "mock-model")
  }
  return cached
}

export function resetAiProviderCache() {
  cached = null
}
