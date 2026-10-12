/** Shared two-column service layout, matching the Design Preview navigation. */
import React from 'react';

/** Mounted page and its navigation label. */
export interface DetailPage { id: string; label: string; content: React.ReactNode }

/** Render a service's left navigation and independently scrolling detail pages.
 * @param props Service title, navigation label, optional group, and controlled page selection.
 * @returns Navigation with retained inactive pages.
 */
export function DetailLayout({ title, navigation, group, pages, selected, onSelect }: {
  title: string; navigation: string; group?: React.ReactNode; pages: readonly DetailPage[];
  selected: string; onSelect: (id: string) => void;
}) {
  const id = React.useId();
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [selected]);
  return <div className="studio-layout">
    <nav className="studio-nav" aria-label={navigation}>
      <strong className="studio-nav-title">{title}</strong>
      {group && <span className="studio-nav-group">{group}</span>}
      {pages.map(page => <button key={page.id} type="button" className="studio-nav-item"
        aria-current={selected === page.id ? 'page' : undefined} aria-controls={`${id}-${page.id}`}
        onClick={() => onSelect(page.id)}>{page.label}</button>)}
    </nav>
    <div className="studio-scroller" ref={scroller} data-studio-scroller="">
      <div className="studio-content">
        {pages.map(page => <section key={page.id} id={`${id}-${page.id}`} aria-label={page.label}
          hidden={selected !== page.id}>{page.content}</section>)}
      </div>
    </div>
  </div>;
}
