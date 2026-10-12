import { defineConfig } from 'vitest/config';

// Unit tests cover pure TypeScript (src/domain, src/backend mappers); no RN runtime.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    environment: 'node',
  },
});
