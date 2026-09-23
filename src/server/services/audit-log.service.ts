import { Prisma } from "@prisma/client"
import { prisma } from "@/server/db/prisma"

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "passwordSalt",
  "token",
  "cookie",
  "authorization",
  "apiKey",
  "api_key",
  "secret",
  "notes",
  "evidenceUrl",
  "email",
  "phone",
  "inputJson",
  "outputJson",
  "prompt",
])

export interface AuditLogInput {
  actorUserId?: string | null
  classroomId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  requestId?: string | null
  metadata?: unknown
}

// Key names are not enough on their own: a caller can pass PII under a new key,
// so long free-text values are also scrubbed by pattern.
function redactValuePatterns(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\b\d{11}\b/g, "[phone]")
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]"
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") {
      const scrubbed = redactValuePatterns(value)
      return scrubbed.length > 2_000 ? `${scrubbed.slice(0, 2_000)}…` : scrubbed
    }
    return value
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1))

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(record).slice(0, 100).map(([key, nested]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[redacted]" : sanitize(nested, depth + 1),
    ]),
  )
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  return sanitize(value) as Prisma.InputJsonValue
}

export async function writeAuditLogInTx(
  tx: Prisma.TransactionClient,
  input: AuditLogInput,
) {
  return tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      classroomId: input.classroomId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      requestId: input.requestId ?? null,
      metadata: jsonValue(input.metadata),
    },
  })
}

export async function writeAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      classroomId: input.classroomId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      requestId: input.requestId ?? null,
      metadata: jsonValue(input.metadata),
    },
  })
}
