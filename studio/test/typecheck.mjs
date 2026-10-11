/** Check Studio integration tests against the selected runtime's official Host references. */
import ts from 'typescript';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const studio = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(process.env.DSH_TEST_RUNTIME_ROOT ?? resolve(studio, '..'));
const base = ts.readConfigFile(resolve(runtime, 'tsconfig.base.json'), ts.sys.readFile).config;
const host = ts.readConfigFile(resolve(runtime, 'tsconfig.host.json'), ts.sys.readFile).config;
const paths = Object.fromEntries(Object.entries(base.compilerOptions.paths).map(([key, values]) => [key, values.map(value => resolve(runtime, value))]));
paths['@studio-test/scaffold'] = [resolve(runtime, 'apps/web/tests/scaffold.ts')];
paths['@studio-test/support'] = [resolve(runtime, 'apps/web/tests/support.ts')];
paths.playwright = [resolve(runtime, 'apps/web/node_modules/playwright')];
const config = ts.parseJsonConfigFileContent({
  compilerOptions: { ...base.compilerOptions, composite: false, incremental: false, noEmit: true, rewriteRelativeImportExtensions: false, paths },
  files: ['test/delegation.browser.test.ts', 'test/agents-view.browser.test.ts', 'test/host-augments.ts'],
  references: host.references.map(ref => ({ path: resolve(runtime, ref.path) })),
}, ts.sys, studio);
const program = ts.createProgram({ rootNames: config.fileNames, options: config.options, projectReferences: config.projectReferences });
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => studio, getNewLine: () => '\n' }));
  process.exitCode = 1;
}
