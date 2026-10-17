#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runtimeCheckTarget } from './runtime-check-target.mjs';

// Never print the authenticated URL. All checks mutate the disposable profile.
runtimeCheckTarget(process.argv[2]);
for (const name of ['master', 'optimized', 'session-roles', 'role']) {
  const script = fileURLToPath(new URL(`check-${name}-runtime.mjs`, import.meta.url));
  const result = spawnSync(process.execPath, [script, process.argv[2]], { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(`FAILED: ${name}; remaining checks were not run.`);
    process.exit(1);
  }
  console.log(`PASS: ${name}`);
}
console.log('4 Web RPC scripts passed. UI rendering, native child execution, Desktop and upgrade migration are not covered.');
