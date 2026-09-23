import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"
import { E2E_CREDENTIALS, E2E_FIXTURES_PATH, resolveE2EEnv } from "./env"
import { seedE2E } from "./seed"

export default async function globalSetup() {
  const config = resolveE2EEnv()
  if (!config.teacherEmail || !config.teacherPassword) {
    throw new Error("TEACHER_LOGIN_EMAIL and TEACHER_LOGIN_PASSWORD are required for the real E2E suite")
  }

  // Apply migrations to the dedicated test database before any browser runs.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: config.databaseUrl },
  })

  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } })
  try {
    const seeded = await seedE2E(prisma, config.teacherEmail)
    // Workers are separate processes, so fixture ids travel through a file.
    writeFileSync(
      E2E_FIXTURES_PATH,
      JSON.stringify(
        {
          classroomId: seeded.classroom.id,
          studentId: seeded.student.id,
          taskId: seeded.task.id,
          rewardId: seeded.reward.id,
          teacher: { identifier: config.teacherEmail, password: config.teacherPassword },
          studentAccount: E2E_CREDENTIALS.student,
          parentAccount: E2E_CREDENTIALS.parent,
          adminAccount: E2E_CREDENTIALS.admin,
          suspendedAccount: E2E_CREDENTIALS.suspended,
        },
        null,
        2,
      ),
    )
  } finally {
    await prisma.$disconnect()
  }
}
