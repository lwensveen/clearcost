import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/src/**/*.{test,spec}.ts', 'packages/**/src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__mocks__/**',
        '**/client.ts',
        '**/index.ts',
        '**/node_modules/**',
        '**/schema.ts',
        '**/types.ts',
        'packages/types/**/*.ts',
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
