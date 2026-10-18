// Real-runtime check for edit_batch against DSH fs-local + fs-observation-policy (no model call).
// Run inside a DSH runtime: node check-edit-batch-runtime.mjs <dsh node_modules dir> <edit-batch.js>
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [nodeModules, bundle] = process.argv.slice(2);
const load = name => import(pathToFileURL(join(nodeModules, '@deepseek-ai', name, 'lib', 'index.js')).href);
const { Context } = await load('cordis');
const { LocalFileSystem } = await load('dsh-fs-local');
const FsPolicy = await load('dsh-fs-observation-policy');
const { installEditBatch } = await import(pathToFileURL(bundle).href);

const dir = await mkdtemp(join(tmpdir(), 'edit-batch-'));
const file = join(dir, 'a.txt');
await writeFile(file, 'alpha\nbeta\ngamma\n');

// Real Cordis context with the real fs-local backend and observation policy; only the tool
// registry and working directory are stubs (edit_batch reads them through ctx.get / ctx.workingDirectory).
const ctx = new Context();
await ctx.plugin(LocalFileSystem, { cwd: dir });
await ctx.plugin(FsPolicy);
let tool; const tools = { register(t) { tool = t; return () => {}; } };
const shim = {
  get: n => n === 'tools' ? tools : ctx.get(n),
  fs: ctx.fs,
  workingDirectory: { async ensure() { return dir; } },
  waterfall: (...args) => ctx.waterfall(...args),
  emit: (...args) => ctx.emit(...args),
};
installEditBatch(shim);
const fs = ctx.fs;
const agent = { session: {}, id: 'a1' };
const exec = { agent, signal: new AbortController().signal };
const target = await fs.resolve(file, { cwd: dir });
const observe = async () => { const info = await fs.stat(target); ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec); };

// 1. Unread file → refused by the observation policy, file unchanged.
await assert.rejects(tool.execute({ file_path: file, edits: [{ old_string: 'alpha', new_string: 'A' }] }, exec), /read/);
assert.equal(await readFile(file, 'utf8'), 'alpha\nbeta\ngamma\n');

// 2. After a read: several edits, one atomic write.
await observe();
const out = await tool.execute({ file_path: file, edits: [{ old_string: 'alpha', new_string: 'A' }, { old_string: 'gamma', new_string: 'G' }] }, exec);
assert.equal(await readFile(file, 'utf8'), 'A\nbeta\nG\n');
assert.equal(out.edits, 2);

// 3. Same file again without re-reading: the tool recorded the new version, so it is allowed.
await tool.execute({ file_path: file, edits: [{ old_string: 'beta', new_string: 'B' }] }, exec);
assert.equal(await readFile(file, 'utf8'), 'A\nB\nG\n');

// 4. One bad edit → nothing written.
await assert.rejects(tool.execute({ file_path: file, edits: [{ old_string: 'A', new_string: 'x' }, { old_string: 'missing', new_string: 'y' }] }, exec), /edits\[1\]/);
assert.equal(await readFile(file, 'utf8'), 'A\nB\nG\n');

// 5. External change after the read → stale, nothing written by the tool.
await writeFile(file, 'A\nB\nG\nexternal\n');
await assert.rejects(tool.execute({ file_path: file, edits: [{ old_string: 'A', new_string: 'x' }] }, exec), e => e.code === 'FS_STALE_VERSION' || /changed|stale|no longer/i.test(String(e.message)));
assert.equal(await readFile(file, 'utf8'), 'A\nB\nG\nexternal\n');

// 6. CRLF file keeps CRLF.
const crlf = join(dir, 'b.txt'); await writeFile(crlf, 'one\r\ntwo\r\n');
const t2 = await fs.resolve(crlf, { cwd: dir }); const i2 = await fs.stat(t2); ctx.emit('fs/observed', t2, { kind: 'present', version: i2.version }, exec);
await tool.execute({ file_path: crlf, edits: [{ old_string: 'one\ntwo', new_string: 'one\nTWO' }] }, exec);
assert.equal(await readFile(crlf, 'utf8'), 'one\r\nTWO\r\n');

console.log('edit_batch runtime check passed (fs-local + fs-observation-policy)');
