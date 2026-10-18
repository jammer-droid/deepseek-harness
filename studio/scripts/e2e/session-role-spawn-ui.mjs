#!/usr/bin/env node
/** #33 actual UI saves + next-child execution on the isolated --mock-llm server. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { run } from './browser.mjs';
import { runAgent, mockSay, mockScript } from './agent.mjs';

const result = await runAgent({ name: 'session-role-spawn-ui' }, async t => {
  assert.ok(t.state.mock, 'requires isolated --mock-llm server');
  const preset = await t.preset({ tools: ['read', 'subagent_role'], roles: [
    { name: 'UI Reviewer 33', role: 'review', model: 'inherit', reasoning: 'inherit', spawn: 'fork', persona: 'UI_PERSONA_33' },
  ] });
  const sessions = [];
  const summary = await run({ name: 'session-role-spawn-ui', views: ['light', 'dark', 'light@520'], locale: 'en-US' }, async app => {
    const session = await t.session(preset);
    sessions.push({ session, view: app.view });
    // Non-current blank sessions are deliberately excluded by WorkspaceBrowser.
    // A completed first turn makes this fixture visible and seeds inheritance evidence.
    const history = 'UI_HISTORY_33';
    const after = await t.prompt(session, `${history}\n${mockSay('UI fixture ready')}`);
    if (!await t.settle(session, { after })) throw new Error('fixture history turn did not finish');
    const title = `UI33 ${app.view.theme} ${app.view.width} ${session.slice(-8)}`;
    await t.rpc('session/rename', { request: { sessionId: session, title } });
    await app.page.reload();
    const toggle = app.page.getByRole('button', { name: /Open sidebar|Expand sidebar/ }).first();
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    if (!await app.step('expand ungrouped sessions', 'role=treeitem[name="Ungrouped"]', { action: async row => {
      if (await row.getAttribute('aria-expanded') !== 'true') await row.click();
    } })) return;
    if (!await app.step('open named test session', `text="${title}"`, { action: 'click' })) return;
    if (!await app.step('open Subagents tab', 'text="Subagents"', { action: 'click' })) return;
    if (!await app.step('edit preset role', 'article:has-text("UI Reviewer 33") >> role=button[name="Edit"]', { action: 'click' })) return;
    await app.check('edit starts with preset Fork', async () => assert.equal(await app.page.getByRole('combobox', { name: 'Start mode' }).inputValue(), 'fork'));
    if (!await app.step('select Fresh', 'role=combobox[name="Start mode"]', { action: field => field.selectOption('fresh') })) return;
    await app.check('edit dialog fits viewport and Save is reachable', async () => {
      const dialog = app.page.getByRole('dialog');
      const box = await dialog.boundingBox();
      const viewport = app.page.viewportSize();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await dialog.getByRole('button', { name: 'Save', exact: true }).click({ trial: true });
    });
    await app.shot('edit-fresh');
    if (!await app.step('save Fresh override', 'role=button[name="Save"]', { action: 'click' })) return;
    await app.page.getByRole('dialog').waitFor({ state: 'hidden' });
    if (!await app.step('add temporary role', 'role=button[name="Add role"]', { action: 'click' })) return;
    await app.check('new role defaults to Fresh', async () => assert.equal(await app.page.getByRole('combobox', { name: 'Start mode' }).inputValue(), 'fresh'));
    if (!await app.step('temporary name', 'role=textbox[name="Name"]', { action: field => field.fill('UI Temporary 33') })) return;
    if (!await app.step('temporary id', 'role=textbox[name="Role ID"]', { action: field => field.fill('temporary33') })) return;
    if (!await app.step('select Fork', 'role=combobox[name="Start mode"]', { action: field => field.selectOption('fork') })) return;
    await app.shot('add-fork');
    if (!await app.step('save Fork addition', 'role=button[name="Save"]', { action: 'click' })) return;
    await app.page.getByRole('dialog').waitFor({ state: 'hidden' });
    await app.page.reload();
    if (!await app.step('reopen Subagents after reload', 'text="Subagents"', { action: 'click' })) return;
    await app.check('persisted Fresh card', async () => {
      assert.match(await app.page.locator('article').filter({ hasText: 'UI Reviewer 33' }).innerText(), /New conversation/);
    });
    await app.check('persisted Fork card', async () => {
      assert.match(await app.page.locator('article').filter({ hasText: 'UI Temporary 33' }).innerText(), /Continue parent/);
    });
    await app.shot('persisted-cards');
    await t.check(`${title}: UI saves persisted`, async () => {
      const view = await t.rpc('studioSessionRoles/view', { sessionId: session });
      assert.equal(view.roles.find(role => role.role === 'review').spawn, 'fresh');
      assert.equal(view.roles.find(role => role.role === 'temporary33').spawn, 'fork');
    });
    for (const [role, count, inherits] of [['review', 1, false], ['temporary33', 2, true]]) {
      const previous = new Set(t.childIds(session));
      const after = await t.prompt(session, mockScript([
        ['subagent_role', { action: 'call', role, task: mockSay('UI saved role child') }], mockSay('done'),
      ]));
      assert.ok(await t.settle(session, { after, children: count }));
      const children = (await t.children(session, { markers: [history] })).filter(child => !previous.has(child.id));
      assert.equal(children.length, 1);
      t.expectChild(`${title}: UI saved ${role} child history`, children[0], inherits ? { inheritsMarker: history } : { notInheritsMarker: history });
    }
  });
  mkdirSync(t.outDir, { recursive: true });
  writeFileSync(path.join(t.outDir, 'ui-summary.json'), JSON.stringify({ ...summary, sessions }, null, 2));
  await t.check('browser UI scenario passes', () => assert.equal(summary.ok, true));
});
writeFileSync(new URL('../../dist/e2e/agent/session-role-spawn-ui/agent-summary.json', import.meta.url), JSON.stringify(result, null, 2));
