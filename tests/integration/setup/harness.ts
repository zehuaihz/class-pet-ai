/**
 * Shared assertions and helpers for the integration suite.
 *
 * Everything here runs against the REAL database through the app's own prisma
 * singleton; no module in the integration suite mocks prisma.
 */
import { Prisma, PrismaClient } from "@prisma/client"
import { expect } from "vitest"
import { prisma } from "@/server/db/prisma"
import { AppError } from "@/server/utils/errors"
import { resolvePrismaTestDatabaseUrl } from "./integration-env"

/** Runs a promise expected to reject with an `AppError` and returns it. */
export async function captureAppError(operation: Promise<unknown>): Promise<AppError> {
  try {
    await operation
  } catch (error: unknown) {
    if (error instanceof AppError) return error
    throw new Error(`Expected an AppError, received: ${describeError(error)}`)
  }
  throw new Error("Expected the operation to reject with an AppError, but it resolved")
}

/** Asserts the operation rejects with an `AppError` carrying `code` (and optional status). */
export async function expectAppError(
  operation: Promise<unknown>,
  code: AppError["code"],
  status?: number,
): Promise<AppError> {
  const error = await captureAppError(operation)
  expect(error.code).toBe(code)
  if (status !== undefined) expect(error.status).toBe(status)
  return error
}

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

/** Asserts the operation fails a database constraint with a specific Prisma error code. */
export async function expectPrismaError(operation: Promise<unknown>, code: string): Promise<Error> {
  try {
    await operation
  } catch (error: unknown) {
    if (isPrismaError(error, code)) return error as Error
    throw new Error(`Expected Prisma error ${code}, received: ${describeError(error)}`)
  }
  throw new Error(`Expected the operation to fail with Prisma error ${code}, but it resolved`)
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

type Settled<T> = { fulfilled: T[]; rejected: unknown[] }

/** Awaits every promise, splitting results instead of failing on the first rejection. */
export async function settleAll<T>(promises: Array<Promise<T>>): Promise<Settled<T>> {
  const results = await Promise.allSettled(promises)
  const fulfilled: T[] = []
  const rejected: unknown[] = []
  for (const result of results) {
    if (result.status === "fulfilled") fulfilled.push(result.value)
    else rejected.push(result.reason)
  }
  return { fulfilled, rejected }
}

/** Rejections that are not the expected `AppError` code - these are harness bugs, not invariant failures. */
export function unexpectedRejections(rejected: unknown[], expectedCode: AppError["code"]): unknown[] {
  return rejected.filter((error) => !(error instanceof AppError) || error.code !== expectedCode)
}

export async function readStudentPoints(studentId: string): Promise<number> {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { totalPoints: true },
  })
  return student.totalPoints
}

export async function readPetGrowth(classroomId: string): Promise<number> {
  const pet = await prisma.pet.findUniqueOrThrow({
    where: { classroomId },
    select: { growthValue: true },
  })
  return pet.growthValue
}

/** Sum of every point delta recorded for a student; must always equal `Student.totalPoints`. */
export async function sumDeltas(studentId: string): Promise<number> {
  const result = await prisma.pointTransaction.aggregate({
    where: { studentId },
    _sum: { delta: true },
  })
  return result._sum.delta ?? 0
}

/**
 * Asserts the denormalised balance matches the append-only ledger.
 *
 * `openingBalance` is the balance the fixture wrote straight into the row
 * before any ledger activity (seeded students start with points but no rows).
 */
export async function expectBalanceMatchesLedger(studentId: string, openingBalance = 0): Promise<number> {
  const [balance, ledger] = await Promise.all([readStudentPoints(studentId), sumDeltas(studentId)])
  expect(balance, `ledger sum ${ledger} + opening ${openingBalance} should equal balance ${balance}`).toBe(
    openingBalance + ledger,
  )
  return balance
}

/**
 * Opens a second, independent connection to the test database.
 *
 * Used by the smoke test to prove a write really landed in PostgreSQL rather
 * than being served from the prisma client's identity map / connection state.
 */
export async function withFreshClient<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
  const client = new PrismaClient({ datasourceUrl: resolvePrismaTestDatabaseUrl() })
  try {
    await client.$connect()
    return await operation(client)
  } finally {
    await client.$disconnect()
  }
}

export function uniqueKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
