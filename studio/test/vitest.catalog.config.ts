import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@local/dsh-studio-catalog/remote': fileURLToPath(new URL('./catalog-remote-fixture.ts', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['studio/test/catalog-ui.test.tsx'] },
});
