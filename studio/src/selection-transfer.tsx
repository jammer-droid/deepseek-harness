import React from 'react';
import { Button } from './ui.tsx';

/** Two-column selection. Marking cards and opening details are independent actions. */
export function SelectionTransfer({ items, selected, onChange, labels, renderDetails }: {
  items: { name: string; description: string }[];
  selected: string[];
  onChange: (names: string[]) => void;
  labels: { available: string; selected: string; add: string; remove: string; empty: string; details?: string };
  renderDetails?: (name: string) => React.ReactNode;
}) {
  const [marked, setMarked] = React.useState<string[]>([]);
  const [detail, setDetail] = React.useState<string>();
  const detailId = React.useId();
  const item = items.find(item => item.name === detail);
  const column = (chosen: boolean) => {
    const entries = items.filter(item => selected.includes(item.name) === chosen);
    return <fieldset className="studio-transfer-column"><legend>{chosen ? labels.selected : labels.available} ({entries.length})</legend>
      <div className="studio-transfer-items">{entries.length ? entries.map(item => <article className="studio-tool-card" data-selected={marked.includes(item.name)} key={item.name}>
        <Button aria-label={item.name} aria-pressed={marked.includes(item.name)} onClick={() => setMarked(current => current.includes(item.name) ? current.filter(name => name !== item.name) : [...current, item.name])}><strong>{item.name}</strong><span className="studio-card-excerpt">{item.description}</span></Button>
        <Button small aria-label={`${labels.details ?? 'Details'}: ${item.name}`} aria-expanded={detail === item.name} aria-controls={detailId} onClick={() => setDetail(detail === item.name ? undefined : item.name)}>{labels.details ?? 'Details'}</Button>
      </article>) : <p>{labels.empty}</p>}</div>
    </fieldset>;
  };
  const availableMarked = marked.filter(name => items.some(item => item.name === name) && !selected.includes(name));
  const selectedMarked = marked.filter(name => items.some(item => item.name === name) && selected.includes(name));
  return <><div className="studio-tool-transfer">{column(false)}<div className="studio-transfer-actions">
    <Button disabled={!availableMarked.length} onClick={() => { onChange([...new Set([...selected, ...availableMarked])]); setMarked([]); }}>{labels.add}</Button>
    <Button disabled={!selectedMarked.length} onClick={() => { onChange(selected.filter(name => !selectedMarked.includes(name))); setMarked([]); }}>{labels.remove}</Button>
  </div>{column(true)}</div><div id={detailId}>{item && <section className="studio-selection-detail"><h3>{item.name}</h3><p className="studio-tool-description">{item.description}</p>{renderDetails?.(item.name)}</section>}</div></>;
}
