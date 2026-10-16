/**
 * Release notes from release/CHANGELOG.md. One section per version:
 *
 *   ## 0.3.0 — 2026-10-16
 *   ...English notes...
 *   ### 한국어
 *   ...Korean notes...
 *
 * The section body (both languages) is the GitHub Release body for tag v<version>.
 */
import { readFile } from 'node:fs/promises';

/** Body of `## <version>` up to the next `## ` heading, trimmed; undefined when absent or empty. */
export function releaseNotes(text, version) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => new RegExp(`^## ${version.replace(/\./g, '\\.')}(\\s|$)`).test(line));
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  const body = lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
  return body || undefined;
}

export async function readReleaseNotes(file, version) {
  const notes = releaseNotes(await readFile(file, 'utf8'), version);
  if (!notes) throw new Error(`release/CHANGELOG.md has no notes for ${version}; add a "## ${version}" section before releasing.`);
  return notes;
}
