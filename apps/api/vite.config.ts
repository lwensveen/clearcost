/// <reference types="vitest" />
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import base from '../../vitest.config';

export default defineConfig({
  ...base,
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  plugins: [tsconfigPaths()],
  test: {
    ...base.test,
    watch: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      ...base.test?.coverage,
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/__mocks__/**', '**/node_modules/**'],
    },
  },
});
