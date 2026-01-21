# RunRoute – Claude Operating Rules

## Source of Truth

| Document | Location |
|----------|----------|
| Project Plan | `/docs/plan/projectplan.md` |
| Phase Docs | `/docs/plan/phases/` |
| Feature Docs | `/docs/features/` |
| Change Log | `/docs/changes/` |
| ADRs | `/docs/adr/` |
| Backlog | `/docs/tracking/backlog.md` |
| Known Issues | `/docs/tracking/issues.md` |
| Specifications | `/spec/` |

## Standard Workflow

1. Read the codebase for relevant files and write a plan to `/docs/plan/projectplan.md`
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with the user to verify the plan
4. Begin working on the todo items, marking them as complete as you go
5. Give a high level explanation of what changes you made at each step
6. Make every task and code change as simple as possible - avoid massive or complex changes
7. Every change should impact as little code as possible - everything is about simplicity
8. Add a review section to the projectplan.md with a summary of changes

## Definition of Done (Every Meaningful Change)

1. Code changes complete
2. Verification steps documented (how to test)
3. A change note created in: `/docs/changes/`
4. If the change is a significant design decision, add an ADR in: `/docs/adr/`

## Change Note Types

`feat` | `fix` | `refactor` | `chore` | `docs`

## Style Conventions

- Prefer small, safe diffs
- Avoid new dependencies unless requested
- Be explicit about iOS vs Android differences for platform APIs
- Keep outputs concise: file paths + actions + verification steps
- Do not implement features that conflict with the plan
- If a request is out-of-plan, propose a plan update first (or add a task)

## Documentation rule (strict)
- Expert subagents MUST NOT write change notes.
- The Lead Engineer is responsible for invoking `/write-change-note`
  once a feature, fix, or refactor is complete.
- No meaningful change is considered "done" until a change note exists
  in /docs/changes/.
