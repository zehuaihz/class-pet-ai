// 演示数据 seed。使用纯 JS（ESM）自包含实现，仅依赖 @prisma/client，
// 因此可在本地（node prisma/seed.mjs）与 Docker 容器（runner 含 node + @prisma/client）中直接运行，
// 无需 tsx 或项目源码（src/）。

import { randomBytes, scryptSync } from "node:crypto"
import { PetStatus, PrismaClient, UserRole } from "@prisma/client"

const prisma = new PrismaClient()

// 与 src/server/auth/password.ts 保持一致
function hashPassword(password) {
  const passwordSalt = randomBytes(16).toString("hex")
  const passwordHash = scryptSync(password, passwordSalt, 64).toString("hex")
  return { passwordHash, passwordSalt }
}

// 与 src/server/domain/student-pet-rules.ts 保持一致
const MAX_PET_LEVEL = 4
const DEFAULT_LEVEL_THRESHOLDS = [0, 10, 30, 60]

const SPECIES_SEED = [
  { key: "cat-orange", name: "橘猫", category: "cat" },
  { key: "dog-golden", name: "金毛", category: "dog" },
  { key: "dog-husky", name: "哈士奇", category: "dog" },
  { key: "dog-corgi", name: "柯基", category: "dog" },
  { key: "animal-panda", name: "熊猫", category: "animal" },
  { key: "animal-rabbit", name: "垂耳兔", category: "animal" },
  { key: "animal-bear", name: "小熊", category: "animal" },
  { key: "bird-parrot", name: "鹦鹉", category: "bird" },
  { key: "bird-pigeon", name: "鸽子", category: "bird" },
  { key: "tiger", name: "老虎", category: "animal" },
  { key: "tortoise", name: "玄武", category: "animal" },
  { key: "phoenix", name: "凤凰", category: "mythical" },
  { key: "dragon", name: "龙", category: "mythical" },
]

function buildVisualSlots(key) {
  const slots = {}
  for (let level = 1; level <= MAX_PET_LEVEL; level += 1) {
    slots[String(level)] = `${key}-lv${level}`
  }
  return slots
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    // 首个系统管理员：重复 seed 也保持 ADMIN。
    update: { role: UserRole.ADMIN },
    create: {
      email: "teacher@example.com",
      name: "张老师",
      role: UserRole.ADMIN,
    },
  })

  // 确保首个系统管理员有登录凭据（密码取环境变量或默认 password123）。
  const existingCredentials = await prisma.passwordCredential.findFirst({ where: { userId: user.id } })
  if (!existingCredentials) {
    const password = process.env.TEACHER_LOGIN_PASSWORD || "password123"
    const { passwordHash, passwordSalt } = hashPassword(password)
    await prisma.passwordCredential.create({ data: { userId: user.id, passwordHash, passwordSalt, requireReset: false } })
  }

  // 平台运营演示数据：学校 + 订阅订单（卖了多少份）。
  const demoSchools = [
    { name: "测试小学", contactName: "王主任", contactPhone: "13800000001" },
    { name: "阳光实验小学", contactName: "陈老师", contactPhone: "13800000002" },
  ]
  const schools = []
  for (const school of demoSchools) {
    schools.push(
      await prisma.school.upsert({
        where: { id: `school_demo_${school.name}` },
        update: { contactName: school.contactName, contactPhone: school.contactPhone },
        create: { id: `school_demo_${school.name}`, ...school },
      }),
    )
  }

  const teacher = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: { schoolId: schools[0].id },
    create: {
      userId: user.id,
      schoolName: "测试小学",
      schoolId: schools[0].id,
    },
  })

  const classroom = await prisma.classroom.upsert({
    where: { inviteCode: "DEMO01" },
    update: {},
    create: {
      teacherId: teacher.id,
      name: "三年级2班",
      grade: "3",
      schoolName: "测试小学",
      inviteCode: "DEMO01",
    },
  })

  // 内置宠物品种目录（占位视觉系统：每级一个 visualKey，后续可换真实 3D 资产）
  for (const [index, species] of SPECIES_SEED.entries()) {
    await prisma.petSpecies.upsert({
      where: { key: species.key },
      update: { name: species.name, category: species.category },
      create: {
        key: species.key,
        name: species.name,
        category: species.category,
        visualSlots: buildVisualSlots(species.key),
        sortOrder: index,
      },
    })
  }

  // 只保留系统内置品种：禁用不在列表中的旧品种，保证「添加学生」的可选宠物与内置目录一致。
  await prisma.petSpecies.updateMany({
    where: { enabled: true, key: { notIn: SPECIES_SEED.map((s) => s.key) } },
    data: { enabled: false },
  })

  // 1~MAX_PET_LEVEL 级默认成长阈值（累计食物）；先删后建，避免残留旧等级配置
  await prisma.$transaction([
    prisma.petLevelConfig.deleteMany({ where: { classroomId: classroom.id } }),
    prisma.petLevelConfig.createMany({
      data: DEFAULT_LEVEL_THRESHOLDS.map((requiredGrowth, index) => ({
        classroomId: classroom.id,
        level: index + 1,
        requiredGrowth,
      })),
    }),
  ])

  // 全局系统名称
  await prisma.systemSetting.upsert({
    where: { key: "systemName" },
    update: {},
    create: { key: "systemName", value: "班级动物园" },
  })

  await prisma.student.createMany({
    data: ["小明", "小红", "小刚", "小丽"].map((name, index) => ({
      classroomId: classroom.id,
      name,
      studentNo: `${index + 1}`.padStart(3, "0"),
      totalPoints: 0,
    })),
    skipDuplicates: true,
  })

  const species = await prisma.petSpecies.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } })
  const students = await prisma.student.findMany({ where: { classroomId: classroom.id }, orderBy: { createdAt: "asc" } })

  // 每位学生分配一只随机品种宠物（Lv1 幼崽）
  for (const [index, student] of students.entries()) {
    const existing = await prisma.studentPet.findFirst({ where: { studentId: student.id, status: PetStatus.GROWING } })
    if (existing) continue
    const speciesEntry = species[index % species.length]
    await prisma.studentPet.create({
      data: {
        studentId: student.id,
        speciesKey: speciesEntry.key,
        name: speciesEntry.name,
        level: 1,
        growthValue: 0,
        status: PetStatus.GROWING,
        adoptionSeq: 1,
      },
    })
  }

  // 订阅订单演示数据：概览页「卖了多少份」有数据可看。
  const existingOrders = await prisma.subscription.count()
  if (existingOrders === 0) {
    const now = new Date()
    const monthsAgo = (months) => {
      const date = new Date(now)
      date.setMonth(date.getMonth() - months)
      return date
    }
    await prisma.subscription.createMany({
      data: [
        {
          schoolId: schools[0].id,
          teacherProfileId: teacher.id,
          plan: "MONTHLY",
          seats: 1,
          amountCents: 9900,
          status: "PAID",
          startedAt: monthsAgo(2),
          expiresAt: monthsAgo(1),
          note: "单教师月付体验",
        },
        {
          schoolId: schools[0].id,
          plan: "YEARLY",
          seats: 5,
          amountCents: 198000,
          status: "PAID",
          startedAt: monthsAgo(1),
          expiresAt: monthsAgo(-11),
          note: "5 个班级年付",
        },
        {
          schoolId: schools[1].id,
          plan: "YEARLY",
          seats: 10,
          amountCents: 398000,
          status: "PAID",
          startedAt: monthsAgo(0),
          expiresAt: monthsAgo(-12),
          note: "整校年付",
        },
      ],
    })
  }

  console.log(`Seeded zoo: ${species.length} species, ${students.length} student pets`)
  console.log(`Seeded platform: ${schools.length} schools, ${existingOrders === 0 ? 3 : existingOrders} subscription orders`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
