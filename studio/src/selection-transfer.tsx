import React from 'react';
import { Button } from './ui.tsx';

/** Two-column selection. Marking cards and opening details are independent actions. */
export function SelectionTransfer({ items, selected, onChange, labels, renderDetails }: {
  items: { name: string; description: string }[];
  selected: string[];
  onChange: (names: string[]) => void;
  labels: { available: string; selected: string; add: string; remove: string; empty: string; details?: string; close?: string };
  renderDetails?: (name: string) => React.ReactNode;
}) {
  const [marked, setMarked] = React.useState<string[]>([]);
  const [detail, setDetail] = React.useState<string>();
  const detailId = React.useId();
  const item = items.find(item => item.name === detail);
  const detailRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = detailRef.current;
    if (!item || !dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    return () => { dialog.close(); trigger?.focus(); };
  }, [item?.name]);
  const column = (chosen: boolean) => {
    const entries = items.filter(item => selected.includes(item.name) === chosen);
    return <fieldset className="studio-transfer-column"><legend>{chosen ? labels.selected : labels.available} ({entries.length})</legend>
      <div className="studio-transfer-items">{entries.length ? entries.map(item => <article className="studio-tool-card" data-selected={marked.includes(item.name)} key={item.name}>
        <Button aria-label={item.name} aria-pressed={marked.includes(item.name)} onClick={() => setMarked(current => current.includes(item.name) ? current.filter(name => name !== item.name) : [...current, item.name])}><strong>{item.name}</strong><span className="studio-card-excerpt">{item.description}</span></Button>
        <Button small aria-label={`${labels.details ?? 'Details'}: ${item.name}`} aria-expanded={detail === item.name} aria-controls={detailId} title={labels.details ?? 'Details'} onClick={() => setDetail(detail === item.name ? undefined : item.name)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" /></svg></Button>
      </article>) : <p>{labels.empty}</p>}</div>
    </fieldset>;
  };
  const availableMarked = marked.filter(name => items.some(item => item.name === name) && !selected.includes(name));
  const selectedMarked = marked.filter(name => items.some(item => item.name === name) && selected.includes(name));
  return <><div className="studio-tool-transfer">{column(false)}<div className="studio-transfer-actions">
    <Button disabled={!availableMarked.length} onClick={() => { onChange([...new Set([...selected, ...availableMarked])]); setMarked([]); }}>{labels.add}</Button>
    <Button disabled={!selectedMarked.length} onClick={() => { onChange(selected.filter(name => !selectedMarked.includes(name))); setMarked([]); }}>{labels.remove}</Button>
  </div>{column(true)}</div><dialog id={detailId} ref={detailRef} className="studio-detail-dialog" aria-labelledby={`${detailId}-title`} onCancel={e => { e.preventDefault(); setDetail(undefined); }}>{item && <section className="studio-selection-detail"><div className="studio-row"><h3 id={`${detailId}-title`}>{item.name}</h3><Button onClick={() => setDetail(undefined)}>{labels.close ?? 'Close'}</Button></div>{renderDetails ? renderDetails(item.name) : <p className="studio-tool-description">{item.description}</p>}</section>}</dialog></>;
}
