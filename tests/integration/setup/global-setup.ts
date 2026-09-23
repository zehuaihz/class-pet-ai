/**
 * Vitest `globalSetup` for the integration suite.
 *
 * Runs once in the main process before any worker is spawned:
 *  1. validates TEST_DATABASE_URL (loud failure when missing / not a *_test db)
 *  2. verifies the target database is reachable
 *  3. applies pending Prisma migrations (or fails loudly when they cannot be applied)
 *  4. verifies every table/column the suite depends on actually exists
 */
import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { resolveTestDatabase, type TestDatabaseTarget } from "./integration-env"

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url))

/** Table -> columns the integration suite depends on. */
const REQUIRED_SCHEMA: Record<string, string[]> = {
  User: ["id", "role", "status", "sessionVersion"],
  PasswordCredential: ["id", "userId", "passwordHash", "passwordSalt"],
  ParentStudent: ["id", "parentId", "studentId"],
  TeacherProfile: ["id", "userId"],
  Classroom: ["id", "teacherId", "inviteCode"],
  Group: ["id", "classroomId", "totalPoints"],
  Student: ["id", "classroomId", "groupId", "totalPoints", "status"],
  PointRule: ["id", "classroomId", "pointDelta", "enabled"],
  PointTransaction: [
    "id",
    "classroomId",
    "studentId",
    "groupId",
    "teacherId",
    "reversalOfId",
    "checkinRecordId",
    "redemptionId",
    "idempotencyKey",
    "requestFingerprint",
    "delta",
    "source",
  ],
  CheckinTask: ["id", "classroomId", "createdByTeacherId", "rewardPoints", "requireEvidence", "status"],
  CheckinRecord: ["id", "taskId", "studentId", "status", "approvedById"],
  Pet: ["id", "classroomId", "growthValue"],
  PetGrowthLog: ["id", "petId", "pointTransactionId", "growthDelta"],
  RewardItem: ["id", "classroomId", "costPoints", "stock", "enabled"],
  RewardRedemption: ["id", "rewardItemId", "studentId", "pointsSpent", "status", "idempotencyKey", "requestFingerprint"],
  AuditLog: ["id", "actorUserId", "classroomId", "action", "entityType", "entityId", "metadata"],
  AiJob: [
    "id",
    "classroomId",
    "teacherId",
    "type",
    "status",
    "attemptCount",
    "maxAttempts",
    "availableAt",
    "lockedAt",
    "claimToken",
    "lastErrorCode",
  ],
}

function localMigrations(): string[] {
  return readdirSync(path.join(projectRoot, "prisma", "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

async function appliedMigrations(client: PrismaClient): Promise<string[]> {
  try {
    const rows = await client.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `
    return rows.map((row) => row.migration_name).sort()
  } catch (error: unknown) {
    // A brand new database has no migrations table yet - that means "nothing
    // applied" and `prisma migrate deploy` will create it below.
    const code = (error as { meta?: { code?: string } }).meta?.code
    if (code === "42P01") return []
    throw error
  }
}

async function currentDatabase(client: PrismaClient): Promise<string> {
  const rows = await client.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `
  return rows[0]?.current_database ?? "<unknown>"
}

function runMigrateDeploy(target: TestDatabaseTarget): void {
  try {
    execFileSync("npx", ["--no-install", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: target.url },
      stdio: "pipe",
      encoding: "utf8",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stdout = (error as { stdout?: string }).stdout ?? ""
    const stderr = (error as { stderr?: string }).stderr ?? ""
    throw new Error(
      [
        `[integration-setup] Prisma migrations are not applied to "${target.databaseName}" and "prisma migrate deploy" failed.`,
        "Apply them manually, then re-run the suite:",
        `  DATABASE_URL="${target.url}" npx prisma migrate deploy`,
        "",
        message,
        stdout,
        stderr,
      ].join("\n"),
    )
  }
}

async function existingColumns(client: PrismaClient): Promise<Set<string>> {
  const rows = await client.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `
  return new Set(rows.map((row) => `${row.table_name}.${row.column_name}`))
}

function missingSchemaObjects(columns: Set<string>): string[] {
  const missing: string[] = []
  for (const [table, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    for (const column of requiredColumns) {
      if (!columns.has(`${table}.${column}`)) missing.push(`${table}.${column}`)
    }
  }
  return missing
}

export default async function globalSetup(): Promise<void> {
  const target = resolveTestDatabase()
  const client = new PrismaClient({ datasourceUrl: target.url })

  try {
    try {
      await client.$connect()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        [
          `[integration-setup] Cannot connect to the test database "${target.databaseName}" at ${target.host}:${target.port}.`,
          "Start the database (docker compose up -d postgres) and re-run the suite.",
          "",
          message,
        ].join("\n"),
      )
    }

    const connected = await currentDatabase(client)
    if (connected !== target.databaseName) {
      throw new Error(
        `[integration-setup] Connected to database "${connected}" but TEST_DATABASE_URL points at "${target.databaseName}".`,
      )
    }

    const expected = localMigrations()
    let applied = await appliedMigrations(client)
    const pending = expected.filter((name) => !applied.includes(name))

    if (pending.length > 0) {
      runMigrateDeploy(target)
      applied = await appliedMigrations(client)
      const stillMissing = expected.filter((name) => !applied.includes(name))
      if (stillMissing.length > 0) {
        throw new Error(
          [
            `[integration-setup] Migrations missing from "${target.databaseName}" after "prisma migrate deploy":`,
            ...stillMissing.map((name) => `  - ${name}`),
          ].join("\n"),
        )
      }
    }

    const unknownApplied = applied.filter((name) => !expected.includes(name))
    if (unknownApplied.length > 0) {
      throw new Error(
        [
          `[integration-setup] Database "${target.databaseName}" has migrations that do not exist in prisma/migrations:`,
          ...unknownApplied.map((name) => `  - ${name}`),
          "Reset the test database before running the suite.",
        ].join("\n"),
      )
    }

    const missing = missingSchemaObjects(await existingColumns(client))
    if (missing.length > 0) {
      throw new Error(
        [
          `[integration-setup] Test database "${target.databaseName}" is missing required schema objects:`,
          ...missing.map((name) => `  - ${name}`),
        ].join("\n"),
      )
    }
  } finally {
    await client.$disconnect()
  }
}
