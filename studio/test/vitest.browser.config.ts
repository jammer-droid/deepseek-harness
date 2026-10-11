/** Source test scaffold with built Host/Client packages; build Studio and runtime first. */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { standardDecoratorPlugin, vitestExecArgv } from '../../vitest.shared.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const runtime = resolve(process.env.DSH_TEST_RUNTIME_ROOT ?? root)
const webRequire = createRequire(resolve(runtime, 'apps/web/package.json'))

export default defineConfig({
  root,
  plugins: [tsconfigPaths({ projects: [resolve(runtime, 'tsconfig.base.json')] }), standardDecoratorPlugin()],
  resolve: { alias: {
    '@studio-test/scaffold': resolve(runtime, 'apps/web/tests/scaffold.ts'),
    playwright: webRequire.resolve('playwright'),
  } },
  test: {
    execArgv: vitestExecArgv,
    include: ['studio/test/role-editor.browser.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: { DSH_SNAPSHOT: 'replay' },
  },
})
