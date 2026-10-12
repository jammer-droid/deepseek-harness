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

test('Systems have a separate identity space and catalog revisions follow effective registrations', () => {
  const revisions = [];
  const registry = new ComponentRegistry(revision => revisions.push(revision));
  const dispose = registry.register(instructionsDefinition);
  const system = { id: instructionsDefinition.id, version: 1, scope: 'workflow', fields: [], executionLocations: ['dsh'], ports: [] };
  const remove = registry.registerSystem(system);
  assert.equal(registry.catalog().revision, 2);
  assert.equal(registry.catalog().systems.length, 1);
  remove(); remove();
  registry.registerSystem(system); remove(); dispose();
  assert.deepEqual(revisions, [1, 2, 3, 4, 5]);
  assert.equal(registry.catalog().systems.length, 1);
});

test('Contradictory ports, scopes, locations and dependencies are refused, not missing providers', () => {
  const registry = new ComponentRegistry();
  const port = { id: 'out', direction: 'output', semantic: 'text', allowedPeers: [], minConnections: 0, maxConnections: 1 };
  for (const extra of [{ ports: [port, port] }, { ports: [{ ...port, minConnections: 2 }] }, { ports: [{ ...port, semantic: '' }] }, { ports: [{ ...port, direction: 'sideways' }] }, { scope: 'workflow' }, { requiredSystems: [{ id: 'absent', version: 0 }] }]) {
    assert.throws(() => registry.register({ ...instructionsDefinition, ...extra }), error => error.reason === 'invalid-definition');
  }
  assert.throws(() => registry.registerSystem({ id: 'system', version: 1, scope: 'workflow', fields: [], executionLocations: [] }), error => error.reason === 'invalid-definition');
  registry.register({ ...instructionsDefinition, requiredSystems: [{ id: 'absent', version: 1 }], ports: [port] });
  assert.equal(registry.catalog().components.length, 1);
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
