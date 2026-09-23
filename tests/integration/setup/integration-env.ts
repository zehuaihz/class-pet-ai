/**
 * Environment resolution for the integration suite.
 *
 * The integration suite talks to a REAL PostgreSQL database and must never
 * silently fall back to the development database (or to "no database at all").
 * Every entry point (vitest global setup, setup files, individual specs)
 * funnels through `resolveTestDatabaseUrl()` so a misconfigured run fails
 * loudly instead of skipping.
 *
 * This module intentionally has NO imports of the Prisma client: it is
 * evaluated BEFORE `process.env.DATABASE_URL` is rewritten, and importing the
 * prisma singleton here would instantiate the client with the wrong URL.
 */

const MISSING_ENV_HINT = [
  "TEST_DATABASE_URL is not set.",
  "",
  "The integration suite requires a dedicated PostgreSQL test database. Run it with:",
  '  TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/class_pet_ai_test?schema=public" npm run test:integration -- --run',
  "",
  "Refusing to fall back to DATABASE_URL (development data would be destroyed by the per-test cleanup).",
].join("\n")

export interface TestDatabaseTarget {
  /** Raw, validated TEST_DATABASE_URL. */
  url: string
  /** Database name parsed out of the URL, e.g. `class_pet_ai_test`. */
  databaseName: string
  /** Host, e.g. `localhost`. */
  host: string
  /** Port, defaults to 5432 when omitted. */
  port: number
}

function fail(message: string): never {
  throw new Error(`[integration-setup] ${message}`)
}

export function parseTestDatabaseUrl(raw: string): TestDatabaseTarget {
  const trimmed = raw.trim()
  if (!trimmed) fail(MISSING_ENV_HINT)

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    fail(`TEST_DATABASE_URL is not a valid URL: ${trimmed}`)
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail(`TEST_DATABASE_URL must use the postgresql:// protocol, received "${parsed.protocol}//".`)
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  if (!databaseName) {
    fail(`TEST_DATABASE_URL must include a database name, received "${trimmed}".`)
  }

  if (!/_test$/i.test(databaseName)) {
    fail(
      [
        `Refusing to run integration tests against database "${databaseName}".`,
        "",
        'The database name must end in "_test" (for example class_pet_ai_test) because every test',
        "deletes all rows from every table before it runs.",
      ].join("\n"),
    )
  }

  if (/prod/i.test(databaseName)) {
    fail(`Refusing to run integration tests against production-looking database "${databaseName}".`)
  }

  if (!parsed.hostname) {
    fail(`TEST_DATABASE_URL must include a host, received "${trimmed}".`)
  }

  return {
    url: trimmed,
    databaseName,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
  }
}

export function resolveTestDatabase(): TestDatabaseTarget {
  const raw = process.env.TEST_DATABASE_URL
  if (!raw || !raw.trim()) fail(MISSING_ENV_HINT)
  return parseTestDatabaseUrl(raw)
}

/** Raw validated URL (no pooling parameters injected). */
export function resolveTestDatabaseUrl(): string {
  return resolveTestDatabase().url
}

export function databaseNameFromUrl(raw: string): string {
  return parseTestDatabaseUrl(raw).databaseName
}

/**
 * The URL actually handed to Prisma (`process.env.DATABASE_URL`).
 *
 * The concurrency specs open up to a dozen parallel interactive transactions
 * on the same row, which would otherwise exhaust the default connection pool
 * (`cpus * 2 + 1`) on small CI runners and surface as P2024 pool timeouts
 * instead of the invariant under test. Pool sizing is pinned here so the
 * suite behaves the same on a 12 core laptop and a 2 core runner.
 */
export function resolvePrismaTestDatabaseUrl(): string {
  const { url } = resolveTestDatabase()
  const parsed = new URL(url)
  if (!parsed.searchParams.has("connection_limit")) parsed.searchParams.set("connection_limit", "20")
  if (!parsed.searchParams.has("pool_timeout")) parsed.searchParams.set("pool_timeout", "30")
  return parsed.toString()
}

/** Number of parallel writers the concurrency specs rely on. */
export const CONCURRENCY = 8
