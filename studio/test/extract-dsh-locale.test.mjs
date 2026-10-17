/** Static DSH locale extraction over a fake git tree. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extract } from '../scripts/extract-dsh-locale.mjs';

const fakeGit = files => args => {
  if (args[0] === 'show') {
    const file = args[1].slice(args[1].indexOf(':') + 1);
    if (!(file in files)) throw new Error('missing');
    return files[file];
  }
  if (args[0] === 'ls-tree') return Object.keys(files).join('\n');
  if (args[0] === 'grep') return Object.entries(files).filter(([, text]) => /(^|[^A-Za-z0-9_])locale\.register\(/.test(text)).map(([file]) => `REF:${file}`).join('\n');
  if (args[0] === 'rev-parse') return 'abc1234\n';
  throw new Error(`unexpected git ${args.join(' ')}`);
};

test('resolves constants, imports, spreads, satisfies, join, and both register forms', () => {
  const result = extract('REF', fakeGit({
    'packages/client/a/src/client/locales.ts': `
      import { sharedEn, sharedZh } from './shared.ts'
      export const NS = 'alpha'
      export const zh = { ...sharedZh, hello: '你好 {name}' } satisfies Record<string, string>
      export const en = { ...sharedEn, hello: 'Hello {name}', long: ['a', 'b'].join('\\n\\n') } as Record<string, string>`,
    'packages/client/a/src/client/shared.ts': `export const sharedEn = { bye: 'Bye' }\nexport const sharedZh = { bye: '再见' }`,
    'packages/client/a/src/client/index.ts': `
      import { en, NS, zh } from './locales.ts'
      export function apply(ctx) { ctx.effect(() => ctx.locale.register(NS, { zh, en })) }`,
    'packages/client/b/src/client/index.ts': `
      const LOCALE_NS = 'beta'
      export function apply(ctx) {
        const dictionaries = [['zh', { ok: '好' }], ['en', { ok: 'OK' }]]
        for (const [locale, dict] of dictionaries) ctx.locale.register(LOCALE_NS, locale, dict)
        const locale = 'gamma'
        ctx.locale.register(locale, 'en', { x: 'X' })
      }`,
    'packages/client/c/src/client/index.ts': `export function create(locale) { locale.register('common', { en: { y: 'Y' } }) }`,
    'packages/client/a/src/client/index.test.ts': `ctx.locale.register('ignored', { en: { z: 'Z' } })`,
  }));
  assert.equal(result.commit, 'abc1234');
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(Object.keys(result.namespaces), ['alpha', 'beta', 'common', 'gamma']);
  assert.deepEqual(result.namespaces.alpha.keys, {
    bye: { zh: '再见', en: 'Bye' }, hello: { zh: '你好 {name}', en: 'Hello {name}' }, long: { en: 'a\n\nb' },
  });
  assert.deepEqual(result.namespaces.beta.keys, { ok: { zh: '好', en: 'OK' } });
  assert.deepEqual(result.namespaces.gamma.keys, { x: { en: 'X' } });
  assert.deepEqual(result.namespaces.alpha.sites, ['packages/client/a/src/client/index.ts:3']);
});

test('reports unresolvable registrations instead of guessing', () => {
  const result = extract('REF', fakeGit({
    'packages/client/d/src/client/index.ts': `export function apply(ctx, ns) { ctx.locale.register(ns, { en: build() }) }`,
  }));
  assert.deepEqual(result.namespaces, {});
  assert.equal(result.unresolved.length, 1);
  assert.match(result.unresolved[0].site, /index\.ts:1$/);
});
