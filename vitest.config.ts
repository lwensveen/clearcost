import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/src/**/*.{test,spec}.ts', 'packages/**/src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      // Release gate coverage focuses on runtime-critical API modules with deterministic tests.
      include: [
        'apps/api/src/lib/{env,errors,http,idempotency,internal-signing,metrics,parse-date-maybe,provenance,refresh-fx,run-cron,run-lock,sweep-stale-imports}.ts',
        'apps/api/src/lib/cron/{runtime,utils}.ts',
        'apps/api/src/modules/quotes/{routes,utils}.ts',
        'apps/api/src/modules/quotes/services/{confidence,quote-landed-cost,source-metadata}.ts',
        'apps/api/src/modules/classify/services/classify-hs6.ts',
        'apps/api/src/modules/usage/services/usage-range.ts',
        'apps/api/src/modules/api-keys/services/issue-api-key.ts',
        'apps/api/src/modules/webhooks/services/{dispatch,secret-kms}.ts',
        'apps/api/src/plugins/{api-key-auth,api-usage,date-serializer,import-instrumentation,swagger}.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__mocks__/**',
        '**/client.ts',
        '**/index.ts',
        '**/node_modules/**',
        '**/schema.ts',
        '**/types.ts',
        '**/coverage/**',
        '**/test-output/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      cleanOnRerun: true,
    },
  },
});
