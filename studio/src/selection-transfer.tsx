import React from 'react';
import { Button } from './ui.tsx';

/** Two-column multi-selection with full, read-only provider descriptions. */
export function SelectionTransfer({ items, selected, onChange, labels }: {
  items: { name: string; description: string }[];
  selected: string[];
  onChange: (names: string[]) => void;
  labels: { available: string; selected: string; add: string; remove: string; empty: string };
}) {
  const [marked, setMarked] = React.useState<string[]>([]);
  const column = (chosen: boolean) => {
    const entries = items.filter(item => selected.includes(item.name) === chosen);
    return <fieldset className="studio-transfer-column"><legend>{chosen ? labels.selected : labels.available} ({entries.length})</legend>
      <div className="studio-transfer-items">{entries.length ? entries.map(item => <label className="studio-tool-card" key={item.name}>
        <span className="studio-row"><input type="checkbox" aria-label={item.name} checked={marked.includes(item.name)} onChange={e => setMarked(current => e.target.checked ? [...current, item.name] : current.filter(name => name !== item.name))} /><strong>{item.name}</strong></span>
        <span className="studio-tool-description">{item.description}</span>
      </label>) : <p>{labels.empty}</p>}</div>
    </fieldset>;
  };
  const availableMarked = marked.filter(name => items.some(item => item.name === name) && !selected.includes(name));
  const selectedMarked = marked.filter(name => items.some(item => item.name === name) && selected.includes(name));
  return <div className="studio-tool-transfer">{column(false)}<div className="studio-transfer-actions">
    <Button disabled={!availableMarked.length} onClick={() => { onChange([...new Set([...selected, ...availableMarked])]); setMarked([]); }}>{labels.add}</Button>
    <Button disabled={!selectedMarked.length} onClick={() => { onChange(selected.filter(name => !selectedMarked.includes(name))); setMarked([]); }}>{labels.remove}</Button>
  </div>{column(true)}</div>;
}
