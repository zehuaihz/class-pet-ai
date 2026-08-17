import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "node:crypto"
import { UserRole } from "@prisma/client"
import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"

export interface CurrentUser {
  id: string
  role: UserRole
  name: string
  status: string
  sessionVersion: number
  teacherProfileId?: string
  studentId?: string
  childStudentIds?: string[]
}

const SESSION_COOKIE = "class_pet_user_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

type SessionPayload = {
  userId: string
  v: number
  exp: number
}

const WEAK_SECRETS = new Set(["change-me", "changeme", "secret", ""])

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || WEAK_SECRETS.has(secret) || secret.length < 32) {
    throw new AppError("INTERNAL_ERROR", "SESSION_SECRET must be a strong random value of at least 32 characters")
  }
  return secret
}

function encodeSession(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

function decodeSession(encoded: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown
    if (typeof parsed !== "object" || parsed === null) return null
    const payload = parsed as Record<string, unknown>
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number" || typeof payload.v !== "number") return null
    return { userId: payload.userId, v: payload.v, exp: payload.exp }
  } catch {
    return null
  }
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url")
}

function verifyToken(token: string): SessionPayload | null {
  const [payloadPart, signature] = token.split(".")
  if (!payloadPart || !signature) return null
  const expected = sign(payloadPart)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  const payload = decodeSession(payloadPart)
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = verifyToken(token)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { teacherProfile: true, studentAccount: true, children: { select: { studentId: true } } },
  })
  if (!user) return null
  if (user.status !== "ACTIVE") return null
  if (user.sessionVersion !== session.v) return null

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    status: user.status,
    sessionVersion: user.sessionVersion,
    teacherProfileId: user.teacherProfile?.id,
    studentId: user.studentAccount?.id,
    childStudentIds: user.children.map((link) => link.studentId),
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AppError("UNAUTHORIZED", "Login required")
  return user
}

export async function requireTeacher() {
  const user = await requireUser()
  if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
    throw new AppError("FORBIDDEN", "Teacher role required")
  }
  let teacherProfileId = user.teacherProfileId
  if (!teacherProfileId) {
    // 系统管理员没有所属班级，但仍需要 TeacherProfile 作为课堂操作的留痕 FK
    // （加分、审批等记录的 teacherId/操作人）。upsert 防并发竞态。
    const profile = await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })
    teacherProfileId = profile.id
  }
  return { ...user, teacherProfileId } as CurrentUser & { teacherProfileId: string }
}

export async function requireStudent() {
  const user = await requireUser()
  if (user.role !== UserRole.STUDENT || !user.studentId) {
    throw new AppError("FORBIDDEN", "Student role required")
  }
  return user as CurrentUser & { studentId: string }
}

export async function requireParent() {
  const user = await requireUser()
  if (user.role !== UserRole.PARENT) {
    throw new AppError("FORBIDDEN", "Parent role required")
  }
  return user as CurrentUser & { childStudentIds: string[] }
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== UserRole.ADMIN) {
    throw new AppError("FORBIDDEN", "Admin role required")
  }
  return user
}

export function createSessionToken(userId: string, sessionVersion: number) {
  const payload = encodeSession({
    userId,
    v: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })
  return `${payload}.${sign(payload)}`
}

export function setSessionCookie(token: string, secure = false) {
  // Secure 仅在真实 HTTPS 请求下启用；若服务器通过 HTTP 访问（docker compose 未配 TLS），
  // 带 Secure 的 cookie 会被浏览器拒绝，导致登录后所有接口报 "Login required"。
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}; Max-Age=${SESSION_TTL_SECONDS}`
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
