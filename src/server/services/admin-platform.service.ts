import { UserRole } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/server/db/prisma"
import { hashPassword } from "@/server/auth/password"
import { writeAuditLogInTx } from "@/server/services/audit-log.service"
import { AppError } from "@/server/utils/errors"

export const SCHOOL_STATUSES = ["ACTIVE", "SUSPENDED"] as const
export const SUBSCRIPTION_STATUSES = ["PAID", "PENDING", "REFUNDED", "CANCELLED"] as const
export const SUBSCRIPTION_PLANS = ["YEARLY", "MONTHLY"] as const

const createTeacherSchema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "密码至少 8 位").max(72),
  schoolId: z.string().min(1).optional(),
})

const listSchoolsSchema = z.object({
  keyword: z.string().trim().min(1).max(100).optional(),
})

const createSchoolSchema = z.object({
  name: z.string().trim().min(1).max(100),
  contactName: z.string().trim().max(50).optional(),
  contactPhone: z.string().trim().max(30).optional(),
})

const updateSchoolSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  status: z.enum(SCHOOL_STATUSES).optional(),
  contactName: z.string().trim().max(50).nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
})

const listClassroomsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().min(1).max(100).optional(),
})

const createSubscriptionSchema = z.object({
  schoolId: z.string().min(1).optional(),
  teacherProfileId: z.string().min(1).optional(),
  plan: z.enum(SUBSCRIPTION_PLANS).default("YEARLY"),
  seats: z.coerce.number().int().min(1).max(10000).default(1),
  amountCents: z.coerce.number().int().min(0).max(100000000).default(0),
  status: z.enum(SUBSCRIPTION_STATUSES).default("PAID"),
  expiresAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(200).optional(),
}).refine((data) => data.schoolId || data.teacherProfileId, {
  message: "订单必须关联学校或教师",
})

/** 开通教师账号：创建 User + 登录凭据 + TeacherProfile（可选挂学校）。 */
export async function createTeacherAccount(actorUserId: string, input: unknown) {
  const parsed = createTeacherSchema.parse(input)

  const existing = await prisma.user.findFirst({ where: { email: parsed.email }, select: { id: true } })
  if (existing) {
    throw new AppError("CONFLICT", "该邮箱已被使用", 409)
  }

  let school: { id: string; name: string } | null = null
  if (parsed.schoolId) {
    school = await prisma.school.findUnique({ where: { id: parsed.schoolId }, select: { id: true, name: true } })
    if (!school) {
      throw new AppError("NOT_FOUND", "学校不存在", 404)
    }
  }

  const { passwordHash, passwordSalt } = hashPassword(parsed.password)

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        role: UserRole.TEACHER,
        status: "ACTIVE",
      },
    })
    await tx.passwordCredential.create({
      data: { userId: user.id, passwordHash, passwordSalt, requireReset: false },
    })
    const profile = await tx.teacherProfile.create({
      data: {
        userId: user.id,
        schoolId: school?.id ?? null,
        schoolName: school?.name ?? null,
      },
    })
    await writeAuditLogInTx(tx, {
      actorUserId: actorUserId,
      action: "ADMIN_CREATE_TEACHER",
      entityType: "User",
      entityId: user.id,
      metadata: { email: parsed.email, schoolId: school?.id ?? null },
    })
    return { user, profile }
  })

  return {
    id: teacher.user.id,
    name: teacher.user.name,
    email: teacher.user.email,
    role: teacher.user.role,
    status: teacher.user.status,
    schoolId: school?.id ?? null,
    schoolName: school?.name ?? null,
  }
}

export async function listSchools(input: unknown) {
  const parsed = listSchoolsSchema.parse(input)
  const schools = await prisma.school.findMany({
    where: parsed.keyword
      ? { name: { contains: parsed.keyword, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { teachers: true, subscriptions: true } },
    },
  })
  return schools.map((school) => ({
    id: school.id,
    name: school.name,
    status: school.status,
    contactName: school.contactName,
    contactPhone: school.contactPhone,
    createdAt: school.createdAt,
    teacherCount: school._count.teachers,
    subscriptionCount: school._count.subscriptions,
  }))
}

export async function createSchool(input: unknown) {
  const parsed = createSchoolSchema.parse(input)
  return prisma.school.create({
    data: {
      name: parsed.name,
      contactName: parsed.contactName,
      contactPhone: parsed.contactPhone,
    },
  })
}

export async function updateSchool(schoolId: string, input: unknown) {
  const parsed = updateSchoolSchema.parse(input)
  const existing = await prisma.school.findUnique({ where: { id: schoolId } })
  if (!existing) {
    throw new AppError("NOT_FOUND", "学校不存在", 404)
  }
  return prisma.school.update({
    where: { id: schoolId },
    data: {
      name: parsed.name,
      status: parsed.status,
      contactName: parsed.contactName ?? undefined,
      contactPhone: parsed.contactPhone ?? undefined,
    },
  })
}

/** 平台班级概览：哪些班级在用（含教师、学校、学生数）。 */
export async function listPlatformClassrooms(input: unknown) {
  const parsed = listClassroomsSchema.parse(input)
  const where = parsed.keyword
    ? { name: { contains: parsed.keyword, mode: "insensitive" as const } }
    : undefined

  const [total, classrooms] = await Promise.all([
    prisma.classroom.count({ where }),
    prisma.classroom.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.limit,
      take: parsed.limit,
      include: {
        teacher: {
          select: {
            id: true,
            schoolId: true,
            user: { select: { name: true, email: true, status: true } },
          },
        },
        _count: { select: { students: true } },
      },
    }),
  ])

  return {
    items: classrooms.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      createdAt: classroom.createdAt,
      studentCount: classroom._count.students,
      teacher: classroom.teacher.user.name,
      teacherEmail: classroom.teacher.user.email,
      teacherStatus: classroom.teacher.user.status,
      schoolId: classroom.teacher.schoolId,
    })),
    meta: { total, page: parsed.page, limit: parsed.limit },
  }
}

export async function listSubscriptions() {
  const orders = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      school: { select: { id: true, name: true } },
      teacherProfile: { select: { id: true, user: { select: { name: true } } } },
    },
  })
  return orders.map((order) => ({
    id: order.id,
    plan: order.plan,
    seats: order.seats,
    amountCents: order.amountCents,
    status: order.status,
    startedAt: order.startedAt,
    expiresAt: order.expiresAt,
    note: order.note,
    createdAt: order.createdAt,
    schoolName: order.school?.name ?? null,
    teacherName: order.teacherProfile?.user.name ?? null,
  }))
}

export async function createSubscription(input: unknown) {
  const parsed = createSubscriptionSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "订单参数不合法", 422)
  }
  const data = parsed.data

  if (data.schoolId) {
    const school = await prisma.school.findUnique({ where: { id: data.schoolId } })
    if (!school) throw new AppError("NOT_FOUND", "学校不存在", 404)
  }
  if (data.teacherProfileId) {
    const teacher = await prisma.teacherProfile.findUnique({ where: { id: data.teacherProfileId } })
    if (!teacher) throw new AppError("NOT_FOUND", "教师不存在", 404)
  }

  return prisma.subscription.create({
    data: {
      schoolId: data.schoolId,
      teacherProfileId: data.teacherProfileId,
      plan: data.plan,
      seats: data.seats,
      amountCents: data.amountCents,
      status: data.status,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      note: data.note,
    },
  })
}

/** 运营看板：平台规模 + 销量汇总 + 近 6 个月月度销量。 */
export async function getPlatformStats() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const [schoolCount, activeSchoolCount, teacherCount, classroomCount, studentCount, paidOrders, activeStudents30d] =
    await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { role: UserRole.TEACHER, status: "ACTIVE" } }),
      prisma.classroom.count(),
      prisma.student.count(),
      prisma.subscription.findMany({
        where: { status: "PAID" },
        select: { seats: true, amountCents: true, createdAt: true },
      }),
      prisma.pointTransaction.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
    ])

  const totalSeats = paidOrders.reduce((sum, order) => sum + order.seats, 0)
  const totalAmountCents = paidOrders.reduce((sum, order) => sum + order.amountCents, 0)

  const monthly = new Map<string, { month: string; seats: number; amountCents: number }>()
  for (let i = 0; i < 6; i += 1) {
    const date = new Date(sixMonthsAgo)
    date.setMonth(date.getMonth() + i)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    monthly.set(month, { month, seats: 0, amountCents: 0 })
  }
  for (const order of paidOrders) {
    const month = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, "0")}`
    const bucket = monthly.get(month)
    if (bucket) {
      bucket.seats += order.seats
      bucket.amountCents += order.amountCents
    }
  }

  return {
    counts: {
      schools: schoolCount,
      activeSchools: activeSchoolCount,
      teachers: teacherCount,
      classrooms: classroomCount,
      students: studentCount,
      activeStudents30d: activeStudents30d.length,
    },
    sales: {
      paidOrders: paidOrders.length,
      totalSeats,
      totalAmountCents,
      monthly: Array.from(monthly.values()),
    },
  }
}
