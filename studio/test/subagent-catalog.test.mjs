import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogRows } from '../src/subagent-catalog-model.ts';

const entries = [
  { id: 'child-a', createdAt: 1, mode: 'continuable', label: 'Implement validation' },
  { id: 'child-b', createdAt: 2, mode: 'external', label: 'Research' },
];
const assignment = { parentId: 'parent', childId: 'child-a', role: { id: 'custom-role', name: 'Host implementer', description: 'Own Host validation' } };

test('ordinary DSH children remain visible without Studio metadata', () => {
  const rows = catalogRows('parent', entries, []);
  assert.deepEqual(rows, entries.map(entry => ({ entry })));
});

test('arbitrary roles join by both parent and child identity without inventing children', () => {
  const rows = catalogRows('parent', entries, [
    assignment,
    { ...assignment, parentId: 'other', role: { ...assignment.role, name: 'Wrong parent' } },
    { ...assignment, childId: 'absent' },
  ]);
  assert.deepEqual(rows[0], { entry: entries[0], assignment });
  assert.deepEqual(rows[1], { entry: entries[1] });
  assert.equal(rows.length, 2);
});

test('catalog order and basic DSH labels are preserved; inputs are not mutated', () => {
  const before = structuredClone({ entries, assignment });
  Object.freeze(entries);
  for (const entry of entries) Object.freeze(entry);
  Object.freeze(assignment.role);
  Object.freeze(assignment);
  const rows = catalogRows('parent', entries, [assignment]);
  assert.deepEqual(rows.map(row => row.entry.label), ['Implement validation', 'Research']);
  assert.deepEqual({ entries, assignment }, before);
});

test('ambiguous Studio assignments fail explicitly rather than selecting a role arbitrarily', () => {
  assert.throws(() => catalogRows('parent', entries, [assignment, { ...assignment }]), /duplicate-subagent-assignment/);
});
