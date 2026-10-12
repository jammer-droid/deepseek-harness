import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentRegistry } from '../packages/workflows/src/component-registry.ts';
const port = (id, direction) => ({ id, direction, semantic: 'text', allowedPeers: ['writer', 'sink'], minConnections: 1, maxConnections: 1 });
const component = { id: 'writer', version: 1, scope: 'role', fields: [{ key: 'text', kind: 'text', required: true }], ports: [port('out', 'output')], requiredSystems: [{ id: 'sink', version: 1 }] };
const system = { id: 'sink', version: 1, scope: 'workflow', fields: [], ports: [port('in', 'input')], executionLocations: ['dsh', 'remote'] };
function fixture() {
  const registry = new ComponentRegistry(); registry.register(component); registry.registerSystem(system);
  const document = { documentVersion: 2, name: 'A', mainRole: { name: 'Main', components: [{ instanceId: 'c', id: 'writer', version: 1, scope: 'role', config: { text: 'Hello' } }] }, systems: [{ instanceId: 's', id: 'sink', version: 1, scope: 'workflow', executionLocation: 'dsh', config: {} }], connections: [{ id: 'wire', from: { kind: 'component', instanceId: 'c', portId: 'out' }, to: { kind: 'system', instanceId: 's', portId: 'in' } }] };
  return { registry, document };
}
test('Registration, configuration, scope and location errors identify the preserved instance', () => {
  for (const [mutate, expected] of [
    [d => { d.mainRole.components[0].id = 'absent'; }, 'missing-registration'],
    [d => { d.mainRole.components[0].version = 2; }, 'version-mismatch'],
    [d => { delete d.mainRole.components[0].config.text; }, 'required-field'],
    [d => { d.mainRole.components[0].config.text = 42; }, 'field-type'],
    [d => { d.mainRole.components[0].scope = 'workflow'; }, 'invalid-scope'],
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
  assert.equal(document.name, 'A'); assert.equal(document.mainRole.components[0].config.text, 'Hello');
  assert.equal(registry.catalog().components.length, 1);
  assert.doesNotThrow(() => structuredClone(registry.catalog()));
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
