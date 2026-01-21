---
name: write-change-note
description: Writes a structured change note into docs/changes/ based on the current git diff (or most recent commit if working tree is clean).
disable-model-invocation: true
---

You are the project change-log writer for RunRoute.

Goal:
- Create a new markdown file under /docs/changes/ documenting the work that was just completed.

Rules:
- Prefer documenting the CURRENT working changes (git diff). If there are no uncommitted changes, document the MOST RECENT commit.
- Keep it concise and factual.
- Always include verification steps.
- Do not include secrets or API keys.

Process:
1) Collect change context
- Run: `git status`
- If there are uncommitted changes:
  - Run: `git diff --stat`
  - Run: `git diff`
- If working tree is clean:
  - Run: `git log -1 --name-only`
  - Run: `git show --stat -1`
  - (Optional) Run: `git show -1` if needed for detail

2) Infer metadata
- Date: today's date (YYYY-MM-DD)
- Type: one of feat | fix | refactor | chore | docs
- Slug: short kebab-case title derived from the change

3) Create the file
- Ensure folder exists: `/docs/changes/`
- Write a new file:
  `/docs/changes/YYYY-MM-DD_<type>_<slug>.md`

4) Use this template

# <type>: <short title>

Date: <YYYY-MM-DD>  
Type: <feat|fix|refactor|chore|docs>

## Summary
- <1–3 bullets of user-visible outcome>

## Motivation
- <why this change was made>

## What changed
- Files:
  - <path> — <what changed>
  - <path> — <what changed>
- Behavioral changes:
  - <bullet list; include platform notes if relevant>

## Risks / Notes
- <edge cases, follow-ups, trade-offs>

## How to verify
- Manual:
  - <steps>
- Commands (only if relevant):
  - <commands>

5) Keep quality high
- If this change relates to iOS/Android differences, call it out explicitly.
- If you detect a significant architectural decision, recommend creating an ADR in `/docs/adr/` (but do not create it unless asked).
