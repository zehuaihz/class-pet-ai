type LogLevel = "info" | "warn" | "error" | "debug"

interface LogContext {
  requestId?: string
  userId?: string
  role?: string
  classroomId?: string
  jobId?: string
  [key: string]: unknown
}

const SENSITIVE_KEYS = new Set(["password", "token", "cookie", "authorization", "apiKey", "api_key", "secret", "notes", "evidenceUrl", "email", "phone"])

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(redact)
  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(record)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "[redacted]"
    } else {
      out[key] = redact(val)
    }
  }
  return out
}

export function log(level: LogLevel, message: string, context: LogContext = {}) {
  const redacted = redact(context) as Record<string, unknown>
  const entry = { time: new Date().toISOString(), level, message, ...redacted }
  const stream = level === "error" ? process.stderr : process.stdout
  stream.write(JSON.stringify(entry) + "\n")
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  debug: (message: string, context?: LogContext) => log("debug", message, context),
}
