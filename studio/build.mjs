import { build, context } from 'esbuild';
const watch = process.argv.includes('--watch');
async function compile(options) {
  if (!watch) return build(options);
  const builder = await context(options);
  await builder.watch();
}
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
for (const part of ['shell', 'demo']) {
  await compile({
    absWorkingDir: root, tsconfig: 'tsconfig.host.json', entryPoints: [`src/host/${part}.ts`], outfile: `packages/${part}/index.js`,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
  });
  await compile({
    absWorkingDir: root, tsconfig: 'tsconfig.client.json', entryPoints: [`src/${part}.tsx`], outfile: `packages/${part}/client.js`,
    bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit'],
    banner: { js: `window.__ModuleLoader__.load({id: '@local/dsh-studio-${part}', factory: (require) => { const module = { exports: {} }; const exports = module.exports;` },
    footer: { js: 'return module.exports; }});' },
  });
}
