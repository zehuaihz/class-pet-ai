import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

/**
 * Integration suite configuration.
 *
 * Deliberately NOT built with `mergeConfig` on top of `vitest.config.ts`:
 * vitest concatenates array options, which would drag the jsdom/react
 * `setupFiles` into these node-environment, database-backed specs.
 *
 * Pooling notes:
 *  - `pool: "forks"` isolates each spec file in a child process so a leaked
 *    prisma connection cannot bleed between files.
 *  - `fileParallelism: false` is REQUIRED: every spec starts by truncating the
 *    whole schema, so two files running at once would delete each other's data.
 *  - the concurrency specs fan out to `CONCURRENCY` parallel transactions; the
 *    pool is widened through the connection string in `integration-env.ts`.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/integration/setup/integration-setup.ts"],
    globalSetup: ["./tests/integration/setup/global-setup.ts"],
    pool: "forks",
    isolate: true,
    fileParallelism: false,
    sequence: { concurrent: false },
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
    reporters: ["default"],
  },
})
