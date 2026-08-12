export interface CommentContext {
  studentName: string
  tone: string
  notes: string
  totalPoints: number
  recentGrowth: number
}

export interface ProviderResult {
  text: string
  provider: string
  modelName: string
  inputTokens?: number
  outputTokens?: number
  latencyMs: number
  providerRequestId?: string
}

export type ProviderErrorCode = "AUTH" | "PERMISSION" | "INVALID_REQUEST" | "RATE_LIMIT" | "TIMEOUT" | "OVERLOAD" | "NETWORK" | "UNKNOWN"

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly retryable: boolean

  constructor(message: string, code: ProviderErrorCode, retryable: boolean) {
    super(message)
    this.name = "ProviderError"
    this.code = code
    this.retryable = retryable
  }
}

export interface AiProvider {
  generateCommentDraft(context: CommentContext, signal?: AbortSignal): Promise<ProviderResult>
}

export function classifyHttpError(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError("authentication failed", "AUTH", false)
  if (status === 400) return new ProviderError("invalid request", "INVALID_REQUEST", false)
  if (status === 429) return new ProviderError("rate limited", "RATE_LIMIT", true)
  if (status === 529) return new ProviderError("provider overloaded", "OVERLOAD", true)
  if (status >= 500) return new ProviderError("provider error", "NETWORK", true)
  return new ProviderError(`unexpected status ${status}`, "UNKNOWN", false)
}
