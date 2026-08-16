import { UserRole } from "@prisma/client"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { hashPassword, verifyPassword } from "@/server/auth/password"
import { AppError } from "@/server/utils/errors"

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().trim().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

function getTeacherCredentials() {
  const email = process.env.TEACHER_LOGIN_EMAIL
  const password = process.env.TEACHER_LOGIN_PASSWORD
  if (!email || !password) throw new AppError("INTERNAL_ERROR", "Teacher login credentials not configured")
  return { email, password }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export async function authenticateTeacher(input: unknown) {
  const { identifier, password } = loginSchema.parse(input)
  const credentials = getTeacherCredentials()

  if (!safeEqual(identifier, credentials.email) || !safeEqual(password, credentials.password)) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials")
  }

  let user = await prisma.user.findUnique({
    where: { email: credentials.email },
    include: { teacherProfile: true, credentials: true },
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: credentials.email,
        name: "张老师",
        role: UserRole.TEACHER,
        credentials: { create: { ...hashPassword(credentials.password) } },
      },
      include: { teacherProfile: true, credentials: true },
    })
  }

  if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) throw new AppError("FORBIDDEN", "Teacher account required")

  if (!user.teacherProfile) {
    const teacherProfile = await prisma.teacherProfile.create({ data: { userId: user.id, schoolName: "测试小学" } })
    user = { ...user, teacherProfile }
  }

  return user
}

const accountLoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().trim().min(1),
})

/**
 * 按账号（邮箱或手机号）登录：查库校验凭据，任意角色均可。
 * DB 中存在该账号时以库内密码为准（env 兜底永不介入）；仅当账号不在库时
 * 回落 authenticateTeacher（env 教师凭据，首次登录自动建号），保证无缝迁移。
 */
export async function authenticateAccount(input: unknown) {
  const { identifier, password } = accountLoginSchema.parse(input)

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }], status: "ACTIVE" },
    include: { credentials: true, teacherProfile: true, studentAccount: true, children: { select: { studentId: true } } },
  })

  if (user) {
    if (user.credentials.length === 0) throw new AppError("UNAUTHORIZED", "该账号未设置密码")
    const matched = user.credentials.find((credential) => verifyPassword(password, credential))
    if (!matched) throw new AppError("UNAUTHORIZED", "账号或密码错误")
    if (matched.requireReset) throw new AppError("FORBIDDEN", "密码需要重置，请联系管理员")
    return user
  }

  return authenticateTeacher({ identifier, password })
}

const credentialLoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().trim().min(1),
  role: z.nativeEnum(UserRole),
})

export async function authenticateWithCredentials(input: unknown) {
  const { identifier, password, role } = credentialLoginSchema.parse(input)
  if (role === UserRole.TEACHER) return authenticateTeacher({ identifier, password })

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
      role,
      status: "ACTIVE",
    },
    include: { credentials: true, studentAccount: true, children: { select: { studentId: true } } },
  })

  if (!user || user.credentials.length === 0) throw new AppError("UNAUTHORIZED", "Invalid credentials")
  const matched = user.credentials.find((credential) => verifyPassword(password, credential))
  if (!matched) throw new AppError("UNAUTHORIZED", "Invalid credentials")
  if (matched.requireReset) throw new AppError("FORBIDDEN", "Password reset required")

  return user
}

export async function setUserPassword(userId: string, password: string) {
  if (password.trim().length < 8) throw new AppError("VALIDATION_ERROR", "Password must be at least 8 characters", 422)
  const { passwordHash, passwordSalt } = hashPassword(password)
  await prisma.passwordCredential.deleteMany({ where: { userId } })
  return prisma.passwordCredential.create({ data: { userId, passwordHash, passwordSalt, requireReset: false } })
}

export async function provisionAccount(input: {
  role: UserRole
  name: string
  email?: string | null
  phone?: string | null
  password: string
  studentId?: string | null
}) {
  const user = await prisma.user.create({
    data: { role: input.role, name: input.name, email: input.email ?? null, phone: input.phone ?? null },
  })
  await setUserPassword(user.id, input.password)
  if (input.role === UserRole.PARENT && input.studentId) {
    await prisma.parentStudent.create({ data: { parentId: user.id, studentId: input.studentId } })
  }
  if (input.role === UserRole.STUDENT && input.studentId) {
    await prisma.student.update({ where: { id: input.studentId }, data: { userId: user.id } })
  }
  return user
}
