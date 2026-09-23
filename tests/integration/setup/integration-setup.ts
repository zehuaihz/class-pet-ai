/**
 * Vitest `setupFiles` for the integration suite (runs once per test file, in
 * the worker, BEFORE the spec module is imported).
 *
 * Responsibilities:
 *  - point `process.env.DATABASE_URL` at the dedicated test database so the
 *    real prisma singleton (`src/server/db/prisma.ts`) connects to it
 *  - prove at runtime that the connection really landed on the *_test database
 *  - wipe every table (FK-safe order) before each test
 *  - disconnect the prisma client after the file finishes
 *
 * All prisma-dependent modules are imported dynamically inside the hooks:
 * static imports would be hoisted above the env rewrite and would instantiate
 * the client against the development database.
 */
import { afterAll, beforeAll, beforeEach } from "vitest"
import { resolvePrismaTestDatabaseUrl, resolveTestDatabase } from "./integration-env"

const target = resolveTestDatabase()
process.env.DATABASE_URL = resolvePrismaTestDatabaseUrl()

type PrismaLike = (typeof import("@/server/db/prisma"))["prisma"]

let prismaRef: PrismaLike | null = null
let cleanupTestDbRef: (() => Promise<void>) | null = null

beforeAll(async () => {
  const [{ prisma }, { cleanupTestDb }] = await Promise.all([
    import("@/server/db/prisma"),
    import("@/test/seeds/cleanup-test-db"),
  ])

  prismaRef = prisma
  cleanupTestDbRef = cleanupTestDb

  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `
  const connected = rows[0]?.current_database
  if (connected !== target.databaseName) {
    throw new Error(
      [
        `[integration-setup] Prisma connected to "${connected}" but TEST_DATABASE_URL targets "${target.databaseName}".`,
        "Refusing to run: the per-test cleanup would delete the wrong data.",
      ].join("\n"),
    )
  }
})

beforeEach(async () => {
  if (!cleanupTestDbRef) throw new Error("[integration-setup] cleanupTestDb was not initialised")
  await cleanupTestDbRef()
})

afterAll(async () => {
  // Leave the database exactly as it was found: the last test of the file
  // would otherwise keep its fixture rows until the next run wipes them.
  if (cleanupTestDbRef) await cleanupTestDbRef()
  await prismaRef?.$disconnect()
  prismaRef = null
})
