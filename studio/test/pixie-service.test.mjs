/** Pixie service in a real Cordis context with fake llm, sessionController, and commands. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import { PixieService } from '../src/host/pixie-service.ts';

async function harness({ sessions = ['s1'] } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'studio-pixie-svc-'));
  const ctx = new Context();
  const commands = new Map();
  for (const key of ['llm', 'sessionController', 'commands']) ctx.provide(key);
  ctx.set('commands', { register: definition => { commands.set(definition.name, definition); return () => commands.delete(definition.name); } });
  ctx.set('llm', {
    stream: async function* () { yield { type: 'text-delta', index: 0, text: 'pong' }; yield { type: 'finish', reason: { kind: 'stop' } }; },
    resolveModelInfo: async () => ({ context: { contextWindow: 64000 } }),
  });
  ctx.set('sessionController', {
    inspect: async id => { if (!sessions.includes(id)) throw new Error(`session "${id}" not found`); return { events: [] }; },
    list: async () => ({ items: sessions.map(sessionId => ({ sessionId })) }),
    modelCatalog: async () => ({ groups: [] }),
  });
  return { ctx, dataDir, commands };
}
const start = async (h) => { const fiber = h.ctx.plugin(PixieService, h.dataDir); await fiber; return fiber; };
const until = async (check) => { for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('timed out'); };

test('registers /pixie and withdraws it on dispose', async () => {
  const h = await harness();
  const fiber = await start(h);
  assert.ok(h.commands.has('pixie'));
  await fiber.dispose();
  assert.equal(h.commands.has('pixie'), false);
});

test('settings, ask, and view go through the service', async () => {
  const h = await harness();
  const fiber = await start(h);
  const service = h.ctx.get('studioPixie');
  await service.saveSettings(JSON.stringify({ model: { provider: 'p', model: 'm' }, contextMode: 'fresh', systemPrompt: '', allowThreadModel: true }));
  await service.ask('s1', JSON.stringify({ question: 'ping' }));
  await until(async () => (await service.view('s1')).record.threads[0]?.turns[0]?.status === 'done');
  const view = await service.view('s1');
  assert.equal(view.record.threads[0].turns[0].answer, 'pong');
  assert.equal(view.contextWindow, 64000);
  assert.equal(view.running, false);
  await fiber.dispose();
});

test('records of deleted sessions are pruned on start; listed (including archived) ones stay', async () => {
  const h = await harness({ sessions: ['kept'] });
  await mkdir(join(h.dataDir, 'pixie'), { recursive: true });
  for (const id of ['kept', 'gone']) await writeFile(join(h.dataDir, 'pixie', `${id}.json`), JSON.stringify({ sessionId: id, threads: [] }));
  const fiber = await start(h);
  await until(async () => (await readdir(join(h.dataDir, 'pixie'))).length === 1);
  assert.deepEqual(await readdir(join(h.dataDir, 'pixie')), ['kept.json']);
  await fiber.dispose();
});

test('a failed session listing prunes nothing', async () => {
  const h = await harness();
  h.ctx.set('sessionController', { inspect: async () => ({ events: [] }), list: async () => { throw new Error('disk busy'); }, modelCatalog: async () => ({}) });
  await mkdir(join(h.dataDir, 'pixie'), { recursive: true });
  await writeFile(join(h.dataDir, 'pixie', 'x.json'), JSON.stringify({ sessionId: 'x', threads: [] }));
  const fiber = await start(h);
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(await readdir(join(h.dataDir, 'pixie')), ['x.json']);
  await fiber.dispose();
});

test('a /pixie turn can be read by command id, and threads can be deleted', async () => {
  const h = await harness();
  const fiber = await start(h);
  const service = h.ctx.get('studioPixie');
  await service.saveSettings(JSON.stringify({ model: { provider: 'p', model: 'm' }, contextMode: 'fresh', systemPrompt: '', allowThreadModel: true }));
  await h.commands.get('pixie').handler({ commandId: 'cmd-9', agent: { id: 's1' }, rawInput: ' ping', attachments: [], signal: new AbortController().signal });
  await until(async () => (await service.commandTurn('s1', 'cmd-9'))?.status === 'done');
  assert.equal((await service.commandTurn('s1', 'cmd-9')).answer, 'pong');
  assert.equal(await service.commandTurn('s1', 'other'), null);
  const threadId = (await service.view('s1')).record.threads[0].id;
  await service.deleteThread('s1', threadId);
  assert.deepEqual((await service.view('s1')).record.threads, []);
  await fiber.dispose();
});
