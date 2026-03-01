import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'worker/src/__tests__/**/*.test.ts',
      'scripts/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['worker/src/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
    },
  },
});
