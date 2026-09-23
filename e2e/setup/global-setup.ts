import { execFileSync } from "node:child_process"
import { PrismaClient } from "@prisma/client"
import { resolveE2EEnv } from "../real/env"
import { seedMockedSpecFixtures } from "../support/seed-fixtures"

/** Classroom id hard-coded in the mocked spec URLs. */
const MOCKED_CLASSROOM_ID = "class_1"

/**
 * The mocked UI specs still need a migrated database for the real login/session
 * path used by the page-level role guards. The development database is never
 * touched: this always targets the dedicated browser-suite database.
 */
export default async function globalSetup() {
  const env = resolveE2EEnv()
  if (!env.teacherEmail) {
    throw new Error("TEACHER_LOGIN_EMAIL is required to authenticate the mocked E2E suite")
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: env.databaseUrl },
  })

  const prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl } } })
  try {
    await seedMockedSpecFixtures(prisma, env.teacherEmail, MOCKED_CLASSROOM_ID)
  } finally {
    await prisma.$disconnect()
  }
}
