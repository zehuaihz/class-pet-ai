import { PetStatus, UserRole } from "@prisma/client"
import { prisma } from "../src/server/db/prisma"
import { DEFAULT_LEVEL_THRESHOLDS, MAX_PET_LEVEL } from "../src/server/domain/student-pet-rules"

const SPECIES_SEED = [
  { key: "cat-orange", name: "橘猫", category: "cat" },
  { key: "cat-black", name: "黑猫", category: "cat" },
  { key: "cat-white", name: "白猫", category: "cat" },
  { key: "dog-golden", name: "金毛", category: "dog" },
  { key: "dog-husky", name: "哈士奇", category: "dog" },
  { key: "dog-corgi", name: "柯基", category: "dog" },
  { key: "animal-panda", name: "熊猫", category: "animal" },
  { key: "animal-rabbit", name: "垂耳兔", category: "animal" },
  { key: "animal-owl", name: "猫头鹰", category: "animal" },
  { key: "animal-bear", name: "小熊", category: "animal" },
] as const

function buildVisualSlots(key: string): Record<string, string> {
  const slots: Record<string, string> = {}
  for (let level = 1; level <= MAX_PET_LEVEL; level += 1) {
    slots[String(level)] = `${key}-lv${level}`
  }
  return slots
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      email: "teacher@example.com",
      name: "张老师",
      role: UserRole.TEACHER,
    },
  })

  const teacher = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      schoolName: "测试小学",
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

  console.log(`Seeded zoo: ${species.length} species, ${students.length} student pets`)
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
