/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import base from '../../vitest.config';

export default defineConfig({
  ...base,
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  plugins: [react(), tsconfigPaths()],
  test: {
    ...base.test,
    watch: false,
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    reporters: ['default'],
    css: true,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      ...base.test?.coverage,
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/__mocks__/**', '**/node_modules/**'],
    },
  },
});
