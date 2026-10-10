# Domain docs

English | [中文](domain.zh.md)

Use one shared domain context for this repository. Existing documentation owns terminology and decisions; do not create a parallel glossary or ADR tree.

## Before exploring

For Studio work, read the [product goals and scope](../../studio/goals.ko.md) and [development guide](../../studio/development.ko.md). Product goals are not shipped behavior; implementation candidates remain proposals until approved.

Read the [shared glossary](../glossary.md), then relevant active Agent Notes under `.agents/notes/`. Use the [Agent Note guide](../../.agents/notes/README.md) to locate records by lifecycle and class.

Implemented notes describe shipped decisions. Proposed notes are not adopted decisions. Rejected notes preserve reasons not to take an approach. Archived notes are frozen historical records, not current authority.

If an optional domain document is absent, continue without requesting that it be created merely to satisfy a skill's default layout.

## Terminology

Use the glossary's canonical terms in issues, proposals, tests, and explanations. When a needed concept is missing, distinguish a genuine terminology gap from an unnecessary synonym.

## Decision conflicts

Explicitly identify any proposal that contradicts an active decision record. Link the record and explain why reopening the decision is warranted; do not silently override it.

## Writing domain docs

Update the existing glossary rather than adding a root `GLOSSARY.md` or `GLOSSARY-MAP.md`. Record durable decision rationale through the existing Agent Note process rather than creating `docs/adr/`.

Follow the repository's documentation, bilingual pairing, and Agent Note creation rules.
