import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { releaseNotes } from '../release/changelog.mjs';

test('release notes are the exact version section, both languages, up to the next version', () => {
  const text = '# Changelog\n\n## 0.3.1 — 2026-10-20\n\nFix.\n\n### 한국어\n\n수정.\n\n## 0.3.0 — 2026-10-16\n\nOld.\n';
  assert.equal(releaseNotes(text, '0.3.1'), 'Fix.\n\n### 한국어\n\n수정.');
  assert.equal(releaseNotes(text, '0.3.0'), 'Old.');
  assert.equal(releaseNotes(text, '0.3'), undefined, 'no prefix match');
  assert.equal(releaseNotes(text, '0.4.0'), undefined);
  assert.equal(releaseNotes('## 0.5.0\n\n', '0.5.0'), undefined, 'an empty section does not count');
});

test('the shipped version has notes in English and Korean', async () => {
  const version = JSON.parse(await readFile(new URL('../packages/shell/package.json', import.meta.url), 'utf8')).version;
  const notes = releaseNotes(await readFile(new URL('../release/CHANGELOG.md', import.meta.url), 'utf8'), version);
  assert.ok(notes, `CHANGELOG.md needs a "## ${version}" section`);
  assert.match(notes, /### 한국어/);
});
