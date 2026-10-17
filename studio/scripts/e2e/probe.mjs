#!/usr/bin/env node
/**
 * L1 act probe for selector repair. Opens the DOM saved at an L0 failure (no server, no state change,
 * safe to repeat) and prints how many elements a candidate selector matches and what they are.
 *
 *   node studio/scripts/e2e/probe.mjs <fail-dir> <item-id> <selector>
 *
 * Scripts and network are disabled: the saved DOM is judged as it was rendered.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from './browser.mjs';

const [dir, id, selector] = process.argv.slice(2);
const file = dir && id && path.join(path.resolve(dir), `${path.basename(id)}.html`);
if (!file || !existsSync(file)) { console.log(`error: no saved page for ${id}`); process.exit(2); }
if (!selector?.trim()) { console.log('matches: 0\nerror: empty selector'); process.exit(1); }

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
try {
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  const page = await context.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent(readFileSync(file, 'utf8'), { waitUntil: 'domcontentloaded' });
  let matches;
  try { matches = page.locator(selector.trim()); await matches.count(); } catch (error) {
    console.log(`matches: 0\nerror: invalid selector: ${String(error.message).split('\n')[0].slice(0, 200)}`);
    process.exit(1);
  }
  const count = await matches.count();
  console.log(`selector: ${selector.trim()}`);
  console.log(`matches: ${count}`);
  for (let index = 0; index < Math.min(count, 5); index++) {
    const element = matches.nth(index);
    const info = await element.evaluate(node => ({
      tag: node.tagName.toLowerCase(),
      role: node.getAttribute('role') ?? '',
      label: node.getAttribute('aria-label') ?? '',
      text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
    }));
    console.log(`#${index + 1}: <${info.tag}>${info.role ? ` role=${info.role}` : ''}${info.label ? ` aria-label="${info.label}"` : ''} text="${info.text}"`);
  }
  if (count > 5) console.log(`… ${count - 5} more`);
} finally {
  await browser.close();
}
