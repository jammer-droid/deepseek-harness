/** Model choices retain unavailable routes and efforts without changing persisted selections. */
import React from 'react';
import type { ModelCatalog, ModelSelection } from '@local/dsh-studio-workflows/types';
import { workflowText } from './workflow-locales.ts';

/** @param props Catalog and explicit selection. @returns Independent route and effort controls. */
export function WorkflowModelForm({ value, catalog, locale, label, enabled, onChange }: {
  value?: ModelSelection | undefined; catalog: ModelCatalog; enabled: boolean; locale: string; label: string; onChange: (value: ModelSelection) => void;
}): React.ReactNode {
  const t = workflowText(locale);
  const routes = catalog.providers.flatMap(provider => provider.models.map(model => ({ provider, model })));
  const selected = routes.find(route => route.provider.id === value?.provider && route.model.id === value?.model);
  const available = selected?.provider.status !== 'failed' && selected?.model.status === 'available';
  const routeKey = (provider: string, model: string) => JSON.stringify([provider, model]);
  const efforts = selected?.model.reasoning?.efforts ?? [];
  return <fieldset><legend>{label}</legend>
    <label>{t.model}<select disabled={!enabled} aria-label={label} value={value ? routeKey(value.provider, value.model) : ''} onChange={event => {
      const route = routes.find(item => routeKey(item.provider.id, item.model.id) === event.target.value);
      if (route) onChange({ ...value, provider: route.provider.id, model: route.model.id });
    }}><option value="" disabled>{t.chooseModel}</option>
      {value && !selected && <option value={routeKey(value.provider, value.model)}>{value.provider} / {value.model} — {t.unavailableValue}</option>}
      {routes.map(({ provider, model }) => <option key={routeKey(provider.id, model.id)} value={routeKey(provider.id, model.id)} disabled={provider.status === 'failed' || model.status === 'failed'}>{provider.name} / {model.name}{provider.status === 'failed' || model.status === 'failed' ? ` — ${t.unavailableValue}` : ''}</option>)}
    </select></label>
    {value && <><label>{t.reasoning}<select disabled={!enabled || !available} aria-label={`${label}: ${t.reasoning}`} value={value.reasoningEffort ?? ''} onChange={event => {
      const { reasoningEffort, ...route } = value;
      onChange(event.target.value ? { ...route, reasoningEffort: event.target.value } : route);
    }}><option value="">{t.providerDefault}{selected?.model.reasoning?.defaultEffort ? ` — ${efforts.find(effort => effort.id === selected.model.reasoning?.defaultEffort)?.name ?? selected.model.reasoning.defaultEffort}` : ''}</option>
      {value.reasoningEffort && !efforts.some(effort => effort.id === value.reasoningEffort) && <option value={value.reasoningEffort}>{value.reasoningEffort} — {t.unavailableValue}</option>}
      {efforts.map(effort => <option key={effort.id} value={effort.id}>{effort.name}</option>)}
    </select></label>{!available && <p role="alert">{t.modelUnavailable}</p>}</>}
  </fieldset>;
}
