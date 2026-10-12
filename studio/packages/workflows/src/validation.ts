/** Pure configuration checks against a detached catalog. */
import type { CatalogSnapshot } from './component-registry.ts';
import type { WorkflowDocument, WorkflowDiagnostic, ValidationResult, WorkflowEndpoint } from './workflow-types.ts';
/** @param document Editable document. @param catalog Detached registration snapshot. @returns Ordered configuration diagnostics. */
export function validateWorkflow(document: WorkflowDocument, catalog: CatalogSnapshot): ValidationResult {
  const diagnostics: WorkflowDiagnostic[] = [];
  for (const kind of ['component', 'system'] as const) {
    const instances = kind === 'component' ? document.mainRole.components : document.systems;
    const definitions = kind === 'component' ? catalog.components : catalog.systems;
    for (const instance of instances) {
      const target = { kind, instanceId: instance.instanceId };
      const add = (code: WorkflowDiagnostic['code'], fieldPath: string, details: WorkflowDiagnostic['details'] = {}) => diagnostics.push({ code, target: { ...target, fieldPath }, relatedIds: [instance.id], details });
      if (instance.scope !== (kind === 'component' ? 'role' : 'workflow')) add('invalid-scope', 'scope', { scope: instance.scope });
      const definition = definitions.find(item => item.id === instance.id);
      if (!definition) { add('missing-registration', 'id'); continue; }
      if (definition.version !== instance.version) { add('version-mismatch', 'version', { expected: definition.version, actual: instance.version }); continue; }
      if ('executionLocation' in instance && 'executionLocations' in definition
        && (instance.executionLocation !== 'dsh' || !definition.executionLocations.includes(instance.executionLocation))) add('unsupported-location', 'executionLocation', { location: instance.executionLocation });
      for (const field of definition.fields) {
        const value = instance.config[field.key];
        if (value === undefined ? field.required : typeof value !== 'string') add(value === undefined ? 'required-field' : 'field-type', `config.${field.key}`, { field: field.key });
      }
    }
  }
  for (const instance of document.mainRole.components) {
    const definition = catalog.components.find(item => item.id === instance.id && item.version === instance.version);
    for (const required of definition?.requiredSystems ?? []) {
      if (!catalog.systems.some(item => item.id === required.id && item.version === required.version)
        || !document.systems.some(item => item.id === required.id && item.version === required.version)) {
        diagnostics.push({ code: 'missing-system', target: { kind: 'component', instanceId: instance.instanceId }, relatedIds: [required.id], details: { version: required.version } });
      }
    }
  }
  const resolve = (endpoint: WorkflowEndpoint) => {
    const instances = endpoint.kind === 'component' ? document.mainRole.components : document.systems;
    const definitions = endpoint.kind === 'component' ? catalog.components : catalog.systems;
    const instance = instances.find(item => item.instanceId === endpoint.instanceId);
    const definition = instance && definitions.find(item => item.id === instance.id && item.version === instance.version);
    return { instance, definition, port: definition?.ports?.find(item => item.id === endpoint.portId) };
  };
  for (const connection of document.connections) {
    const from = resolve(connection.from); const to = resolve(connection.to);
    const add = (code: WorkflowDiagnostic['code'], side: string, relatedIds: string[] = []) => diagnostics.push({ code, target: { kind: 'connection', connectionId: connection.id, fieldPath: side }, relatedIds, details: {} });
    for (const side of ['from', 'to'] as const) {
      const endpoint = connection[side]; const resolved = side === 'from' ? from : to;
      if (!resolved.instance) add('missing-instance', side, [endpoint.instanceId]);
      else if (!resolved.definition) {
        const definitions = endpoint.kind === 'component' ? catalog.components : catalog.systems;
        const instance = resolved.instance;
        add(definitions.some(item => item.id === instance.id) ? 'version-mismatch' : 'missing-registration', side, [endpoint.instanceId]);
      }
      else if (!resolved.port) add('missing-port', side, [endpoint.portId]);
      else if (resolved.port && resolved.port.direction !== (side === 'from' ? 'output' : 'input')) add('port-direction', side, [endpoint.portId]);
    }
    if (from.port && to.port && from.instance && to.instance) {
      if (from.port.semantic !== to.port.semantic) add('port-semantic', 'to', [from.port.semantic, to.port.semantic]);
      if (!from.port.allowedPeers.includes(to.instance.id)) add('port-peer', 'from', [to.instance.id]);
      if (!to.port.allowedPeers.includes(from.instance.id)) add('port-peer', 'to', [from.instance.id]);
    }
  }
  for (const kind of ['component', 'system'] as const) {
    const instances = kind === 'component' ? document.mainRole.components : document.systems;
    const definitions = kind === 'component' ? catalog.components : catalog.systems;
    for (const instance of instances) {
      const definition = definitions.find(item => item.id === instance.id && item.version === instance.version);
      for (const port of definition?.ports ?? []) {
        const count = document.connections.reduce((sum, connection) => sum + [connection.from, connection.to].filter(endpoint => endpoint.kind === kind && endpoint.instanceId === instance.instanceId && endpoint.portId === port.id).length, 0);
        if (count < port.minConnections || count > port.maxConnections) diagnostics.push({ code: 'connection-count', target: { kind, instanceId: instance.instanceId, fieldPath: `ports.${port.id}` }, relatedIds: [port.id], details: { count, min: port.minConnections, max: port.maxConnections } });
      }
    }
  }
  return { catalogRevision: catalog.revision, valid: diagnostics.length === 0, diagnostics };
}
