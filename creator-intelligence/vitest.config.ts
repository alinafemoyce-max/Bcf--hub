import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // 'server-only' throws outside Next's server bundle; it is a no-op guard in tests.
      'server-only': path.resolve(import.meta.dirname, 'tests/helpers/empty.ts')
    }
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000 }
});
