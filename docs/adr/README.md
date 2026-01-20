# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the RunRoute project.

## What is an ADR?

An ADR captures an important architectural decision along with its context and consequences.

## When to Write an ADR

Write an ADR when:
- Choosing between multiple viable approaches
- Making decisions that are difficult to reverse
- Selecting technologies, libraries, or patterns
- Establishing conventions that affect the whole codebase

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| - | *No ADRs yet* | - | - |

## Template

Create new ADRs as `NNNN-title.md` (e.g., `0001-use-zustand-for-state.md`):

```markdown
# NNNN: Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by XXXX

## Context

What is the issue that we're seeing that motivates this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- Benefit 1
- Benefit 2

### Negative
- Tradeoff 1
- Tradeoff 2

### Neutral
- Side effect 1

## Alternatives Considered

### Alternative 1
- Pros: ...
- Cons: ...
- Why not chosen: ...
```

## Statuses

- **Proposed**: Under discussion
- **Accepted**: Approved and in effect
- **Deprecated**: No longer applies
- **Superseded**: Replaced by another ADR
