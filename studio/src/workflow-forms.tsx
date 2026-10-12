/** Declaration-driven configuration forms preserve unknown instances and dangling connections. */
import React from 'react';
import type { CatalogSnapshot, WorkflowDocument, WorkflowDiagnostic, InstanceId, ConnectionId, WorkflowEndpoint, PortDefinition, ConfigValue, RoleId, WorkflowRole, ModelCatalog, ModelSelection } from '@local/dsh-studio-workflows/types';
import { workflowText } from './workflow-locales.ts';
import { WorkflowModelForm } from './workflow-model-form.tsx';
import { Button } from './ui.tsx';

/** @param props Current document, available declarations and Host diagnostics. @returns Editable systems, components and connections. */
export function WorkflowForms({ document, catalog, models, enabled, diagnostics, locale, onChange }: {
  document: WorkflowDocument; catalog: CatalogSnapshot; models: ModelCatalog; enabled: boolean; diagnostics: WorkflowDiagnostic[]; locale: string; onChange: (document: WorkflowDocument) => void;
}) {
  const t = workflowText(locale);
  const [selectedId, setSelectedId] = React.useState<RoleId | null>(document.roles[0]?.id ?? null);
  const [initialChoice, setInitialChoice] = React.useState<ModelSelection>();
  const role = document.roles.find(item => item.id === selectedId);
  const updateRole = (next: WorkflowRole) => onChange({ ...document, roles: document.roles.map(item => item.id === next.id ? next : item) });
  const textValue = (value: ConfigValue | undefined): string => typeof value === 'string' ? value : '';
  const endpoints: { endpoint: WorkflowEndpoint; port: PortDefinition; registration: string; label: string }[] = [];
  for (const kind of ['component', 'system'] as const) {
    const instances = kind === 'component' ? document.roles.flatMap(role => role.components) : document.systems;
    for (const instance of instances) {
      const definition = (kind === 'component' ? catalog.components : catalog.systems).find(item => item.id === instance.id && item.version === instance.version);
      for (const port of definition?.ports ?? []) endpoints.push({ endpoint: { kind, instanceId: instance.instanceId, portId: port.id }, port, registration: instance.id, label: `${instance.id} · ${instance.instanceId} · ${port.id}` });
    }
  }
  const key = (endpoint: WorkflowEndpoint) => JSON.stringify(endpoint);
  const outputs = endpoints.filter(item => item.port.direction === 'output');
  const inputs = endpoints.filter(item => item.port.direction === 'input');
  const allows = (from: typeof endpoints[number], to: typeof endpoints[number]) => from.port.semantic === to.port.semantic && from.port.allowedPeers.includes(to.registration) && to.port.allowedPeers.includes(from.registration);
  const pairs = outputs.flatMap(from => inputs.filter(to => allows(from, to)).map(to => ({ from: from.endpoint, to: to.endpoint })));
  const pair = pairs[0];
  const pairKey = (pair: { from: WorkflowEndpoint; to: WorkflowEndpoint }) => `${key(pair.from)}>${key(pair.to)}`;
  function notices(kind: WorkflowDiagnostic['target']['kind'], id?: string) {
    return diagnostics.filter(item => item.target.kind === kind && (kind === 'connection' ? item.target.connectionId === id : kind === 'role' ? item.target.roleId === id : item.target.instanceId === id)).map((item, index) => <p role="alert" key={index}>{t.diagnostics[item.code]} {item.target.fieldPath} {item.relatedIds.join(', ')} {Object.values(item.details).join(', ')}</p>);
  }
  function components(): React.ReactNode {
    if (!role) return null;
    return <fieldset><legend>{t.role}</legend>
      <WorkflowModelForm value={role.model} catalog={models} enabled={enabled} locale={locale} label={t.roleModel} onChange={model => updateRole({ ...role, model })} />
      {notices('role', role.id)}
      <label>{t.name}<input value={role.name} onChange={event => updateRole({ ...role, name: event.target.value })} /></label>
      {role.components.map(instance => {
        const definition = catalog.components.find(item => item.id === instance.id && item.version === instance.version);
        return <fieldset key={instance.instanceId}><legend>{instance.id} · {instance.instanceId}</legend>
          {!definition ? <p>{t.unknown}</p> : definition.fields.map(field => <label key={field.key}>{instance.id === 'studio.instructions' ? t.instructions : field.key}<textarea aria-label={instance.id === 'studio.instructions' ? t.instructions : field.key} disabled={!enabled} value={textValue(instance.config[field.key])} onChange={event => updateRole({ ...role, components: role.components.map(item => item.instanceId === instance.instanceId ? { ...item, config: { ...item.config, [field.key]: event.target.value } } : item) })} /></label>)}
          {notices('component', instance.instanceId)}
          <Button onClick={() => updateRole({ ...role, components: role.components.filter(item => item.instanceId !== instance.instanceId) })}>{t.removeComponent}: {instance.id}</Button>
        </fieldset>;
      })}
      {catalog.components.filter(item => item.scope === 'role').map(definition => <Button key={definition.id} disabled={!enabled} onClick={() => updateRole({ ...role, components: [...role.components, { instanceId: crypto.randomUUID() as InstanceId, id: definition.id, version: definition.version, scope: 'role', config: Object.fromEntries(definition.fields.map(field => [field.key, ''])) }] })}>{definition.id === 'studio.instructions' ? t.add : `${t.addComponent}: ${definition.id}`}</Button>)}
    </fieldset>;
  }
  return <>{notices('document')}
    {!document.initialModel && <><WorkflowModelForm value={initialChoice} catalog={models} enabled={enabled} locale={locale} label={t.initialModel} onChange={setInitialChoice} />
      <Button disabled={!enabled || !initialChoice || !models.providers.some(provider => provider.id === initialChoice.provider && provider.status !== 'failed' && provider.models.some(model => model.id === initialChoice.model && model.status === 'available' && (!initialChoice.reasoningEffort || model.reasoning?.efforts.some(effort => effort.id === initialChoice.reasoningEffort))))} onClick={() => { if (initialChoice) onChange({ ...document, initialModel: { ...initialChoice }, roles: document.roles.map(item => ({ ...item, model: { ...initialChoice } })) }); }}>{t.applyInitial}</Button></>}
    <p>{t.modelCopy}</p>
    {models.status !== 'available' && <p role="alert">{models.failure?.code === 'service-unavailable' ? t.modelsServiceUnavailable : t.modelsPartial}</p>}
    <label>{t.mainRole}<select aria-label={t.mainRole} value={document.mainRoleId} onChange={event => onChange({ ...document, mainRoleId: event.target.value as RoleId })}>
      {!document.roles.some(item => item.id === document.mainRoleId) && <option value={document.mainRoleId}>{document.mainRoleId} — {t.unavailableValue}</option>}
      {document.roles.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
    </select></label>
    <label>{t.selectRole}<select aria-label={t.selectRole} value={role?.id ?? ''} onChange={event => setSelectedId(event.target.value as RoleId)}><option value="" disabled>{t.selectRole}</option>{document.roles.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>
    <Button onClick={() => { const id = crypto.randomUUID() as RoleId; onChange({ ...document, roles: [...document.roles, { id, name: '', components: [], ...(document.initialModel ? { model: { ...document.initialModel } } : {}) }] }); setSelectedId(id); }}>{t.addRole}</Button>
    <Button disabled={!role} onClick={() => { onChange({ ...document, roles: document.roles.filter(item => item.id !== selectedId) }); setSelectedId(null); }}>{t.deleteRole}</Button>
    {components()}
    <fieldset><legend>{t.systems}</legend>
      {document.systems.map(instance => {
        const definition = catalog.systems.find(item => item.id === instance.id && item.version === instance.version);
        return <fieldset key={instance.instanceId}><legend>{instance.id} · {instance.instanceId}</legend>
          {!definition ? <p>{t.unknown}</p> : <>
            <label>{t.location}<select disabled={!enabled} value={instance.executionLocation} onChange={event => onChange({ ...document, systems: document.systems.map(item => item.instanceId === instance.instanceId ? { ...item, executionLocation: event.target.value } : item) })}>
              {!definition.executionLocations.includes(instance.executionLocation) && <option>{instance.executionLocation}</option>}{definition.executionLocations.map(location => <option key={location}>{location}</option>)}
            </select></label>
            {definition.fields.map(field => <label key={field.key}>{field.key}<textarea aria-label={instance.id === 'studio.instructions' ? t.instructions : field.key} disabled={!enabled} value={textValue(instance.config[field.key])} onChange={event => onChange({ ...document, systems: document.systems.map(item => item.instanceId === instance.instanceId ? { ...item, config: { ...item.config, [field.key]: event.target.value } } : item) })} /></label>)}
          </>}{notices('system', instance.instanceId)}
          <Button onClick={() => onChange({ ...document, systems: document.systems.filter(item => item.instanceId !== instance.instanceId) })}>{t.removeSystem}: {instance.id}</Button>
        </fieldset>;
      })}
      {!catalog.systems.length && <p>{t.noSystems}</p>}
      {catalog.systems.map(definition => <Button key={definition.id} disabled={!enabled} onClick={() => onChange({ ...document, systems: [...document.systems, { instanceId: crypto.randomUUID() as InstanceId, id: definition.id, version: definition.version, scope: 'workflow', executionLocation: definition.executionLocations[0]!, config: Object.fromEntries(definition.fields.map(field => [field.key, ''])) }] })}>{t.addSystem}: {definition.id}</Button>)}
    </fieldset>
    <fieldset><legend>{t.connections}</legend>
      {!catalog.components.some(item => item.ports?.length) && !catalog.systems.some(item => item.ports?.length) && <p>{t.noPorts}</p>}
      {document.connections.map(connection => <fieldset key={connection.id}><legend>{connection.id}</legend>
        <label>{t.connections}<select aria-label={t.connections} disabled={!enabled} value={pairKey(connection)} onChange={event => {
          const selected = pairs.find(pair => pairKey(pair) === event.target.value);
          if (selected) onChange({ ...document, connections: document.connections.map(item => item.id === connection.id ? { ...item, ...selected } : item) });
        }}>
          {!pairs.some(pair => pairKey(pair) === pairKey(connection)) && <option value={pairKey(connection)}>{t.unknown}</option>}
          {pairs.map(pair => <option key={pairKey(pair)} value={pairKey(pair)}>{endpoints.find(item => key(item.endpoint) === key(pair.from))?.label} → {endpoints.find(item => key(item.endpoint) === key(pair.to))?.label}</option>)}
        </select></label>
        {(['from', 'to'] as const).map(side => {
          const peer = endpoints.find(item => key(item.endpoint) === key(connection[side === 'from' ? 'to' : 'from']));
          const choices = (side === 'from' ? outputs : inputs).filter(item => !peer || (side === 'from' ? allows(item, peer) : allows(peer, item)));
          const current = choices.find(item => key(item.endpoint) === key(connection[side]));
          return <label key={side}>{t[side]}<select aria-label={t[side]} disabled={!enabled} value={key(connection[side])} onChange={event => {
            const endpoint = choices.find(item => key(item.endpoint) === event.target.value)?.endpoint;
            if (endpoint) onChange({ ...document, connections: document.connections.map(item => item.id === connection.id ? { ...item, [side]: endpoint } : item) });
          }}>
            {!current && <option value={key(connection[side])}>{connection[side].instanceId} · {connection[side].portId} — {t.unknown}</option>}
            {choices.map(item => <option key={key(item.endpoint)} value={key(item.endpoint)}>{item.label}</option>)}
          </select></label>;
        })}{notices('connection', connection.id)}
        <Button onClick={() => onChange({ ...document, connections: document.connections.filter(item => item.id !== connection.id) })}>{t.removeConnection}</Button>
      </fieldset>)}
      <Button disabled={!enabled || !pair} onClick={() => { if (pair) onChange({ ...document, connections: [...document.connections, { id: crypto.randomUUID() as ConnectionId, ...pair }] }); }}>{t.addConnection}</Button>
    </fieldset>
  </>;
}
