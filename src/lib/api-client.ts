export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { code?: string; message?: string } | string
}

export class ApiClientError extends Error {
  readonly code?: string
  readonly status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiClientError"
    this.status = status
    this.code = code
  }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  let payload: ApiEnvelope<T> | null = null
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiClientError("服务器返回无效响应", response.status)
  }

  if (!response.ok || !payload.success) {
    const error = payload.error
    const message = typeof error === "string" ? error : error?.message ?? "请求失败"
    const code = typeof error === "string" ? undefined : error?.code
    throw new ApiClientError(message, response.status, code)
  }

  return payload.data as T
}
