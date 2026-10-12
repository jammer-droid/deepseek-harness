/** Studio-owned presentation; CSS ships inside each Client bundle, not a host package import. */
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
