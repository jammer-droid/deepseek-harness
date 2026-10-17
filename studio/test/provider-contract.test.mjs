/** SettingsX provider definitions: invalid files are rejected with every issue, valid ones normalize. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProviderDefinition, protocolEndpoint } from '../src/provider-contract.ts';

const valid = (patch = {}) => ({
  version: 1, id: 'local-llm', name: 'Local LLM', protocol: 'openai-chat', baseURL: 'http://127.0.0.1:11434/v1/',
  models: [{ id: 'qwen3:8b', name: 'Qwen3 8B', contextWindow: 32768, maxTokens: 4096 }], credential: { kind: 'none' }, ...patch,
});
const codes = input => { const result = parseProviderDefinition(input); assert.equal(result.ok, false); return result.issues.map(issue => `${issue.code}@${issue.path}`); };

test('a valid definition normalizes the URL and keeps only declared fields', () => {
  const result = parseProviderDefinition(JSON.stringify(valid({ headers: { 'X-Team': 'studio' } })));
  assert.equal(result.ok, true);
  assert.equal(result.definition.baseURL, 'http://127.0.0.1:11434/v1');
  assert.deepEqual(result.definition.headers, { 'X-Team': 'studio' });
  assert.equal(protocolEndpoint(result.definition), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(protocolEndpoint({ ...result.definition, protocol: 'openai-responses' }), 'http://127.0.0.1:11434/v1/responses');
});

test('every problem in one file is reported, not only the first', () => {
  assert.deepEqual(codes({ version: 2, id: 'Bad Id', protocol: 'grpc', baseURL: 'ftp://x', models: [], credential: { kind: 'oauth' }, extra: true }), [
    'unknown-field@extra', 'version@version', 'id@id', 'required@name', 'protocol@protocol', 'url@baseURL', 'models-empty@models', 'credential-kind@credential.kind',
  ]);
});

test('broken JSON, empty models, duplicates, and bad numbers are rejected', () => {
  assert.deepEqual(codes('{ not json'), ['json@']);
  assert.deepEqual(codes(valid({ models: undefined })), ['required@models']);
  assert.deepEqual(codes(valid({ models: [{ id: 'a' }, { id: 'a', contextWindow: 0, maxTokens: 1.5, image: true }] })),
    ['unknown-field@models[1].image', 'model-duplicate@models[1].id', 'number@models[1].contextWindow', 'number@models[1].maxTokens']);
});

test('credential kinds of later releases are recognized but refused for now', () => {
  for (const kind of ['credential', 'command']) {
    const result = parseProviderDefinition(valid({ credential: { kind } }));
    assert.equal(result.ok, false);
    assert.deepEqual(result.issues, [{ code: 'credential-unsupported', path: 'credential.kind', detail: kind }]);
  }
  assert.deepEqual(codes(valid({ credential: { kind: 'none', token: 'x' } })), ['unknown-field@credential.token']);
});

test('reserved headers and secrets in URLs cannot be set by a definition', () => {
  assert.deepEqual(codes(valid({ headers: { Authorization: 'Bearer x', 'User-Agent': 'other', 'X-Ok': 'line\nbreak' } })),
    ['header@headers.Authorization', 'header@headers.User-Agent', 'header@headers.X-Ok']);
  assert.deepEqual(codes(valid({ baseURL: 'https://user:pass@example.com/v1' })), ['url@baseURL']);
  assert.deepEqual(codes(valid({ baseURL: 'https://example.com/v1?key=secret' })), ['url@baseURL']);
});
