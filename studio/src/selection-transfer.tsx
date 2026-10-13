import React from 'react';
import { Button, SectionHead } from './ui.tsx';

/** Browse available cards; selected cards and their edits stay visible during search. */
export function SelectionTransfer({ items, selected, onChange, labels, renderDetails, renderIndicator, query = '' }: {
  items: { name: string; description: string; searchText?: string }[];
  selected: string[];
  onChange: (names: string[]) => void;
  labels: { available: string; selected: string; add: string; remove: string; empty: string; details?: string; close?: string; noResults?: string };
  renderDetails?: (name: string) => React.ReactNode;
  renderIndicator?: (name: string) => React.ReactNode;
  query?: string;
}) {
  const [detail, setDetail] = React.useState<string>();
  const detailId = React.useId();
  const matches = (item: typeof items[number]) => `${item.name}\n${item.description}\n${item.searchText ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
  const column = (chosen: boolean) => {
    const entries = items.filter(item => selected.includes(item.name) === chosen && (chosen || matches(item)));
    return <section className="studio-transfer-column" aria-label={chosen ? labels.selected : labels.available}>
      <SectionHead title={chosen ? labels.selected : labels.available} />
      <div className="studio-transfer-items">{entries.length ? entries.map(item => <article className="studio-card" key={item.name}>
        <SectionHead title={item.name} actions={<>{renderIndicator?.(item.name)}<Button small aria-label={`${chosen ? labels.remove : labels.add}: ${item.name}`} onClick={() => onChange(chosen ? selected.filter(name => name !== item.name) : [...new Set([...selected, item.name])])}>{chosen ? labels.remove : labels.add}</Button></>} />
        <p className="studio-card-excerpt">{item.description}</p>
        <Button small aria-label={`${labels.details ?? 'Details'}: ${item.name}`} aria-expanded={detail === item.name} aria-controls={detail === item.name ? detailId : undefined} onClick={() => setDetail(detail === item.name ? undefined : item.name)}>{detail === item.name ? labels.close ?? 'Close' : labels.details ?? 'Details'}</Button>
        {detail === item.name && <section id={detailId} className="studio-selection-detail">{renderDetails ? renderDetails(item.name) : <p className="studio-tool-description">{item.description}</p>}</section>}
      </article>) : <p className="studio-muted" role="status">{!chosen && query.trim() ? labels.noResults ?? labels.empty : labels.empty}</p>}</div>
    </section>;
  };
  return <div className="studio-comparison-grid">{column(false)}{column(true)}</div>;
}
