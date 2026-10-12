import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentRegistry } from '../packages/workflows/src/component-registry.ts';
const port = (id, direction) => ({ id, direction, semantic: 'text', allowedPeers: ['writer', 'sink'], minConnections: 1, maxConnections: 1 });
const component = { id: 'writer', version: 1, scope: 'role', fields: [{ key: 'text', kind: 'text', required: true }], ports: [port('out', 'output')], requiredSystems: [{ id: 'sink', version: 1 }] };
const system = { id: 'sink', version: 1, scope: 'workflow', fields: [], ports: [port('in', 'input')], executionLocations: ['dsh', 'remote'] };
function fixture() {
  const registry = new ComponentRegistry(); registry.register(component); registry.registerSystem(system);
  const document = { documentVersion: 3, name: 'A', mainRoleId: 'main', roles: [{ id: 'main', name: 'Main', components: [{ instanceId: 'c', id: 'writer', version: 1, scope: 'role', config: { text: 'Hello' } }] }], systems: [{ instanceId: 's', id: 'sink', version: 1, scope: 'workflow', executionLocation: 'dsh', config: {} }], connections: [{ id: 'wire', from: { kind: 'component', instanceId: 'c', portId: 'out' }, to: { kind: 'system', instanceId: 's', portId: 'in' } }] };
  return { registry, document };
}
test('All roles receive component checks and deleting the main role preserves missing references', () => {
  const { registry, document } = fixture();
  document.roles.push({ id: 'reviewer', name: 'Reviewer', components: [{ instanceId: 'review', id: 'writer', version: 1, scope: 'role', config: {} }] });
  assert.ok(registry.validate(document).diagnostics.some(item => item.code === 'required-field' && item.target.instanceId === 'review'));
  document.roles.shift();
  const before = structuredClone(document);
  const result = registry.validate(document);
  assert.ok(result.diagnostics.some(item => item.code === 'missing-main-role'));
  assert.ok(result.diagnostics.some(item => item.code === 'missing-instance' && item.target.connectionId === 'wire'));
  assert.deepEqual(document, before);
});

test('Registration, configuration, scope and location errors identify the preserved instance', () => {
  for (const [mutate, expected] of [
    [d => { d.roles[0].components[0].id = 'absent'; }, 'missing-registration'],
    [d => { d.roles[0].components[0].version = 2; }, 'version-mismatch'],
    [d => { delete d.roles[0].components[0].config.text; }, 'required-field'],
    [d => { d.roles[0].components[0].config.text = 42; }, 'field-type'],
    [d => { d.roles[0].components[0].scope = 'workflow'; }, 'invalid-scope'],
    [d => { d.systems[0].executionLocation = 'remote'; }, 'unsupported-location'],
  ]) {
    const { registry, document } = fixture(); mutate(document);
    const before = structuredClone(document);
    const diagnostic = registry.validate(document).diagnostics.find(item => item.code === expected);
    assert.ok(diagnostic, expected); assert.ok(diagnostic.target.instanceId);
    assert.deepEqual(document, before);
  }
});

test('Connections locate unavailable endpoint registrations and versions without deleting data', () => {
  for (const [field, value, code] of [['id', 'absent', 'missing-registration'], ['version', 2, 'version-mismatch']]) {
    const { registry, document } = fixture(); document.systems[0][field] = value;
    const before = structuredClone(document);
    const diagnostic = registry.validate(document).diagnostics.find(item => item.code === code && item.target.kind === 'connection');
    assert.deepEqual(diagnostic?.target, { kind: 'connection', connectionId: 'wire', fieldPath: 'to' });
    assert.deepEqual(diagnostic.relatedIds, ['s']);
    assert.deepEqual(document, before);
  }
});

test('Ports diagnose missing references, direction, meaning, peers and cardinality', () => {
  for (const [change, expected] of [
    [d => { d.connections[0].to.portId = 'gone'; }, 'missing-port'],
    [d => { [d.connections[0].from, d.connections[0].to] = [d.connections[0].to, d.connections[0].from]; }, 'port-direction'],
    [d => { d.connections = []; }, 'connection-count'],
    [d => { d.connections.push({ ...d.connections[0], id: 'second' }); }, 'connection-count'],
  ]) {
    const { registry, document } = fixture(); change(document);
    assert.ok(registry.validate(document).diagnostics.some(item => item.code === expected), expected);
  }
  for (const [extra, expected] of [[{ semantic: 'bytes' }, 'port-semantic'], [{ allowedPeers: ['other'] }, 'port-peer']]) {
    const { document } = fixture(); const registry = new ComponentRegistry(); registry.register(component);
    registry.registerSystem({ ...system, ports: [{ ...system.ports[0], ...extra }] });
    assert.ok(registry.validate(document).diagnostics.some(item => item.code === expected), expected);
  }
});

test('Host-only semantic validators cannot mutate caller documents or serialized catalog', () => {
  const { document } = fixture(); const registry = new ComponentRegistry();
  registry.register(component, (instance, copy, catalog) => {
    instance.config.text = 'Changed'; copy.name = 'Changed'; catalog.components.length = 0;
    return [{ code: 'semantic', target: { kind: 'component', instanceId: instance.instanceId }, relatedIds: [], details: { rule: 'example' } }];
  });
  registry.registerSystem(system);
  assert.equal(registry.validate(document).diagnostics[0].code, 'semantic');
  assert.equal(document.name, 'A'); assert.equal(document.roles[0].components[0].config.text, 'Hello');
  assert.equal(registry.catalog().components.length, 1);
  assert.doesNotThrow(() => structuredClone(registry.catalog()));
});

test('Disabled instances retain data, skip checks, and cannot satisfy active requirements', () => {
  const { registry, document } = fixture();
  const other = structuredClone(document);
  document.systems[0].enabled = false;
  const disabled = structuredClone(document);
  const result = registry.validate(document);
  assert.deepEqual(result.diagnostics.map(item => item.code), ['missing-system', 'connection-count']);
  assert.ok(result.diagnostics.every(item => item.target.instanceId === 'c'));
  assert.deepEqual(document, disabled);
  assert.equal(registry.validate(other).valid, true);
  document.roles[0].components[0].enabled = false;
  document.roles[0].components[0].config = {};
  document.systems[0].id = 'removed-provider';
  assert.equal(registry.validate(document).valid, true);
  document.roles[0].components[0].enabled = true;
  assert.ok(registry.validate(document).diagnostics.some(item => item.code === 'required-field'));
  assert.equal(document.connections.length, 1);
});

test('Disabled instances do not invoke provider semantic validators', () => {
  const { document } = fixture();
  const registry = new ComponentRegistry();
  registry.register(component, () => { throw new Error('Disabled validator invoked'); });
  registry.registerSystem(system);
  document.roles[0].components[0].enabled = false;
  assert.doesNotThrow(() => registry.validate(document));
});

test('Host validates required systems and directed compatible connections against one catalog revision', () => {
  const { registry, document } = fixture();
  assert.deepEqual(registry.validate(document), { catalogRevision: 2, valid: true, diagnostics: [] });
  document.systems = [];
  const result = registry.validate(document);
  assert.equal(result.valid, false);
  assert.deepEqual(result.diagnostics.map(d => [d.code, d.target.kind]), [['missing-system', 'component'], ['missing-instance', 'connection']]);
  assert.equal(result.diagnostics[1].target.connectionId, 'wire');
});
