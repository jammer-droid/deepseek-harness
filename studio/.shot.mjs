import { chromium } from '/Users/home/playground/vibecoding/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs';
const [url, lang, only] = process.argv.slice(2);
const out = `/tmp/guide-shots/${lang}`;
const L = lang === 'ko'
  ? { create: '프리셋 만들기', list: '프리셋 목록', exec: '실행 설정', tools: '프롬프트·도구', preview: '프롬프트 미리보기', ctx: '런타임 컨텍스트', configTitle: 'Config 덮어쓰기', turn: '턴 시작 내용', add: '플러그인 추가', copy: '복사', done: '완료', close: '닫기', settings: '설정' }
  : { create: 'Create preset', list: 'Preset list', exec: 'Execution settings', tools: 'Prompts & tools', preview: 'Preview prompt', ctx: 'Runtime context', configTitle: 'Config overrides', turn: 'Turn start', add: 'Add plugin', copy: 'Create copy', done: 'Done', close: 'Close preview', settings: 'Edit' };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' })).newPage();
const wait = ms => page.waitForTimeout(ms);
const shot = async name => { if (!only || only.split(',').includes(name)) { await page.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); } };
const button = text => page.getByRole('button', { name: text, exact: true }).first();
await page.goto(url); await wait(4000);
for (let i = 0; i < 6; i++) {
  const dialog = page.locator('[role=dialog]:visible, [role=presentation]:visible').first();
  if (!(await dialog.count())) break;
  let b = dialog.getByRole('button', { name: /^(Configure later|Continue|Got it|Skip|Close)$/ }).first();
  if (!(await b.count())) b = dialog.getByRole('button').last();
  if (await b.isDisabled()) break;
  await b.click(); await wait(1200);
}
await page.getByText('DSH Studio', { exact: true }).first().click(); await wait(4000);
await shot('preset-list');
// Copy Optimized to get an editable preset.
const optimized = page.locator('article.studio-preset-card').filter({ hasText: 'Optimized' });
await optimized.getByRole('button', { name: L.copy, exact: true }).click(); await wait(2500);
await page.getByRole('tab', { name: L.exec }).click(); await wait(1500);
await page.locator('.studio-tab-body:visible').first().evaluate(el => el.scrollIntoView());
await shot('execution-settings');
// Scroll the plugin list down so the compaction rows and origin badges show.
const pluginList = page.locator('.studio-tab-body:visible ul.studio-picker-list').first();
await pluginList.evaluate(el => { const row = [...el.querySelectorAll('li')].find(li => li.textContent.includes('compaction-basic')); row?.scrollIntoView({ block: 'center' }); });
await wait(500);
await shot('plugin-inclusion');
// Exclude automatic compaction to show the dependency lock.
const compact = pluginList.locator('li').filter({ hasText: 'compaction-basic' }).getByRole('switch');
await compact.click(); await wait(600);
await shot('plugin-exclusion');
await compact.click(); await wait(400);
// Add plugin dialog.
await button(L.add).click(); await wait(800);
await shot('add-plugin');
await page.locator('dialog[open]').getByRole('button', { name: L.done }).click(); await wait(500);
// Config list (second picker): scroll into view.
const configList = page.locator('.studio-tab-body:visible ul.studio-picker-list').nth(1);
await configList.evaluate(el => el.closest('.studio-tab-body').querySelectorAll('h2, h3, .studio-section-head, [class*=section]').forEach(() => {}));
await page.getByText(L.configTitle, { exact: true }).first().evaluate(el => el.scrollIntoView({ block: 'start' }));
await page.mouse.wheel(0, -80); await wait(500);
await shot('config-overrides');
// Prompt preview views.
await page.getByRole('tab', { name: L.tools }).click(); await wait(1200);
await page.getByRole('button', { name: L.preview }).first().click(); await wait(6000);
await shot('prompt-preview');
const dialog = page.locator('dialog[open]');
await dialog.getByRole('radio').filter({ hasText: L.ctx }).click(); await wait(800);
await shot('preview-runtime-context');
await dialog.getByRole('radio').filter({ hasText: L.turn }).click(); await wait(800);
await dialog.locator('input[aria-label="time-context · timeZone"]').fill('Asia/Seoul').catch(() => {});
await wait(400);
await shot('preview-turn-start');
await browser.close();
