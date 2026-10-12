import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentRegistry, RegistrationError, instructionsDefinition } from '../packages/workflows/src/component-registry.ts';

test('Registration snapshots are detached and old disposal cannot remove a replacement', () => {
  const registry = new ComponentRegistry();
  const dispose = registry.register(instructionsDefinition);
  const snapshot = registry.describe();
  snapshot[0].fields[0].key = 'changed';
  assert.equal(registry.describe()[0].fields[0].key, 'text');
  assert.throws(() => registry.register(instructionsDefinition), error => error instanceof RegistrationError && error.reason === 'duplicate-id');
  dispose();
  assert.deepEqual(registry.describe(), []);
  registry.register(instructionsDefinition);
  dispose();
  assert.equal(registry.describe().length, 1);
});

test('Invalid identities, versions and repeated field keys never enter the catalog', () => {
  const registry = new ComponentRegistry();
  for (const definition of [
    { ...instructionsDefinition, id: ' ' },
    { ...instructionsDefinition, version: 0 },
    { ...instructionsDefinition, fields: [{ key: '', kind: 'text', required: true }] },
    { ...instructionsDefinition, fields: [...instructionsDefinition.fields, ...instructionsDefinition.fields] },
  ]) {
    assert.throws(() => registry.register(definition), error => error instanceof RegistrationError && error.reason === 'invalid-definition');
    assert.deepEqual(registry.describe(), []);
  }
});
