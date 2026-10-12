/** Restrict staged changes to Studio; explicit approvals name exact outside paths. */
import { execFileSync } from 'node:child_process';

try {
  const approved = JSON.parse(process.env.STUDIO_APPROVED_PATHS ?? '[]');
  if (!Array.isArray(approved) || approved.some(path => typeof path !== 'string' || !path || path.includes('*'))) throw new Error('STUDIO_APPROVED_PATHS must be a JSON array of exact repository-relative paths.');
  if (approved.length && !process.env.STUDIO_APPROVAL_REASON?.trim()) throw new Error('Approved outside paths require STUDIO_APPROVAL_REASON and prior user approval.');
  // No rename detection: inspect both deleted source and added destination paths.
  const paths = execFileSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const blocked = paths.filter(path => !path.startsWith('studio/') && !approved.includes(path));
  if (blocked.length) throw new Error(`Studio commits cannot change these paths:\n${blocked.map(path => `  ${JSON.stringify(path)}`).join('\n')}\nUnstage them. Outside changes require explicit user approval; do not bypass this hook.`);
  if (approved.length) console.log(`Studio scope exception: ${process.env.STUDIO_APPROVAL_REASON}\n${JSON.stringify(approved)}`);
  console.log(`Studio staged scope: ${paths.length} path(s) accepted.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
