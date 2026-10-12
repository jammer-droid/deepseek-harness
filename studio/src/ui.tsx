/** Studio-owned presentation; CSS ships inside each Client bundle, not a host package import.
 * This module must not import host primitives: Node unit tests load it, and primitives import CSS modules.
 * Primitive-backed parts live in `ui-host.tsx`. See `docs/design-system.md`.
 */
import React from 'react';
import { studioStyles as css } from './ui-styles.ts';

/** Scope theme aliases and styles to one mounted Studio surface.
 * @param props Localized content and optional layout class.
 * @returns A self-contained surface whose stylesheet leaves with its mount.
 */
export function StudioSurface({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`studio-ui ${className}`}><style>{css}</style>{children}</div>;
}
/** Preserve native button semantics while sharing Studio control styling.
 * @param props Native attributes, optional primary emphasis, and optional compact size.
 * @returns A keyboard-accessible button with no owned copy.
 */
export function Button({ primary = false, small = false, className = '', type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; small?: boolean }) {
  return <button {...props} type={type} className={`studio-button ${primary ? 'studio-primary' : ''} ${small ? 'studio-small' : ''} ${className}`} />;
}

/** Page title block; at most one per section.
 * @param props Title, optional description, optional right-aligned actions, and extra lines such as a status line.
 * @returns Page header.
 */
export function PageHead({ title, description, actions, children }: React.PropsWithChildren<{ title: string; description?: string; actions?: React.ReactNode }>) {
  return <header className={`studio-page-head ${actions ? 'studio-page-head-actions' : ''}`}>
    <div>
      <h2>{title}</h2>
      {description && <p className="studio-muted">{description}</p>}
      {children}
    </div>
    {actions && <div className="studio-inline-actions">{actions}</div>}
  </header>;
}

/** Heading row inside a page with optional trailing actions.
 * @param props Heading, optional supporting line, optional actions, and whether the row holds a form field.
 * @returns Section heading row.
 */
export function SectionHead({ title, description, actions, field = false }: { title: React.ReactNode; description?: string; actions?: React.ReactNode; field?: boolean }) {
  return <div className={`studio-section-head ${field ? 'studio-section-head-field' : ''}`}>
    {description ? <div><h3 className="studio-panel-title">{title}</h3><p className="studio-muted">{description}</p></div> : typeof title === 'string' ? <h3 className="studio-panel-title">{title}</h3> : title}
    {actions && <div className="studio-inline-actions">{actions}</div>}
  </div>;
}

/** Quiet page-wide note, such as a preview or scope statement.
 * @param props Localized note.
 * @returns Note line.
 */
export function Note({ children }: React.PropsWithChildren) {
  return <p className="studio-note" role="note">{children}</p>;
}

/** Persistent in-place problem tied to the surface, with an optional recovery action.
 * @param props Localized message and optional action.
 * @returns Alert row that stays until its state resolves.
 */
export function Notice({ children, action }: React.PropsWithChildren<{ action?: React.ReactNode }>) {
  return <div role="alert" className="studio-notice-row"><span>{children}</span>{action}</div>;
}

/** One tab in a {@link TabBar}. */
export interface TabItem<Value extends string> { value: Value; label: React.ReactNode }

/** Sticky underline tabs; selecting a tab keeps the bar in view instead of returning to the page top.
 * @param props Accessible label, items, selected value, change callback, and an optional trailing action.
 * @returns Tab bar preceded by its scroll marker.
 */
export function TabBar<Value extends string>({ label, items, value, onChange, trailing }: {
  label: string; items: readonly TabItem<Value>[]; value: Value; onChange: (value: Value) => void; trailing?: { label: React.ReactNode; onClick: () => void };
}) {
  const marker = React.useRef<HTMLDivElement>(null);
  const select = (next: Value) => {
    onChange(next);
    const node = marker.current;
    let scroller = node?.closest<HTMLElement>('[data-studio-scroller]');
    // Narrow layouts scroll the whole Studio page instead of the content column.
    if (scroller && getComputedStyle(scroller).overflowY === 'visible') scroller = scroller.closest<HTMLElement>('.studio-page');
    if (!node || !scroller) return;
    const offset = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0) scroller.scrollTop += offset;
  };
  return <>
    <div ref={marker} />
    <div className="studio-tabs" role="tablist" aria-label={label}>
      {items.map(item => <button key={item.value} type="button" role="tab" className="studio-tab" aria-selected={item.value === value} onClick={() => select(item.value)}>{item.label}</button>)}
      {trailing && <button type="button" className="studio-tab" onClick={trailing.onClick}>{trailing.label}</button>}
    </div>
  </>;
}

/** Tab content area; its minimum height keeps the sticky bar in place when a shorter tab replaces a longer one.
 * @param props Tab content.
 * @returns Tab panel.
 */
export function TabPanel({ children }: React.PropsWithChildren) {
  return <div role="tabpanel" className="studio-tab-panel">{children}</div>;
}

/** List on the left and detail on the right; stacks when the content column is narrow.
 * @param props Accessible list label, list items, and detail content.
 * @returns Two-column body.
 */
export function MasterDetail({ label, list, children }: React.PropsWithChildren<{ label: string; list: React.ReactNode }>) {
  return <div className="studio-master-detail">
    <nav className="studio-list" aria-label={label}>{list}</nav>
    <div className="studio-detail">{children}</div>
  </div>;
}

/** Selectable row in a {@link MasterDetail} list.
 * @param props Selection state, select callback, and content.
 * @returns List button.
 */
export function ListItem({ selected, onClick, children }: React.PropsWithChildren<{ selected: boolean; onClick: () => void }>) {
  return <button type="button" className="studio-list-item" aria-current={selected ? 'true' : undefined} onClick={onClick}>{children}</button>;
}

/** Group caption inside a list or navigation.
 * @param props Localized caption.
 * @returns Caption.
 */
export function ListGroup({ children }: React.PropsWithChildren) {
  return <span className="studio-list-group">{children}</span>;
}

/** Clickable summary card in a grid.
 * @param props Title row, detail lines, and select callback.
 * @returns Tile button.
 */
export function Tile({ title, onClick, children }: React.PropsWithChildren<{ title: React.ReactNode; onClick: () => void }>) {
  return <button type="button" className="studio-tile" onClick={onClick}><span className="studio-tile-title">{title}</span>{children}</button>;
}

/** One choice in a picker list inside a dialog.
 * @param props Title row, description, optional radio selection state, and select callback.
 * @returns Picker option button.
 */
export function PickOption({ title, description, checked, onClick }: { title: React.ReactNode; description: React.ReactNode; checked?: boolean; onClick: () => void }) {
  return <button type="button" className="studio-pick" {...(checked === undefined ? {} : { role: 'radio', 'aria-checked': checked })} onClick={onClick}>
    <span className="studio-pick-title">{title}</span>
    <span className="studio-muted">{description}</span>
  </button>;
}
