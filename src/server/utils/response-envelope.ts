export type SuccessEnvelope<T> = {
  success: true
  data: T
  error: null
  meta: unknown | null
}

export type ErrorEnvelope = {
  success: false
  data: null
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: null
}

export function ok<T>(data: T, meta: unknown | null = null): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    error: null,
    meta,
  }
}

export function fail(code: string, message: string, details?: unknown): ErrorEnvelope {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: null,
  }
}
