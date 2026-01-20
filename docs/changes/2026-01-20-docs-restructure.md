# docs: Restructure documentation folder hierarchy

**Date**: 2026-01-20
**Type**: docs

## Summary

Reorganized project documentation to clearly separate project planning, tracking, feature documentation, and change logs.

## Changes

### New Structure

```
docs/
├── plan/                           # Project planning
│   ├── projectplan.md              # Main project plan
│   └── phases/                     # Phase completion docs
├── tracking/                       # Project tracking
│   ├── README.md                   # Overview
│   ├── backlog.md                  # Feature backlog
│   └── issues.md                   # Known issues
├── features/                       # Feature documentation
│   ├── README.md                   # Feature index
│   ├── _template.md                # Template for new docs
│   └── route-generation.md         # Route generation system
├── changes/                        # Change logs
│   └── README.md                   # Format guide
└── adr/                            # Architecture Decision Records
    └── README.md                   # ADR index + template
```

### Files Moved

| From | To |
|------|-----|
| `projectplan.md` | `docs/plan/projectplan.md` |
| `phases/Phase1.md` | `docs/plan/phases/phase-01-setup.md` |
| `phases/Phase2.md` | `docs/plan/phases/phase-02-auth.md` |
| `phases/Phase3.md` | `docs/plan/phases/phase-03-route-planning.md` |
| `phases/Phase4.md` | `docs/plan/phases/phase-04-database.md` |
| `phases/Phase5.md` | `docs/plan/phases/phase-05-tracking.md` |
| `phases/Phase6.md` | `docs/plan/phases/phase-06-history.md` |
| `phases/Phase7.md` | `docs/plan/phases/phase-07-social.md` |
| `phases/Phase8.md` | `docs/plan/phases/phase-08-profile.md` |
| `phases/Phase9A.md` | `docs/plan/phases/phase-09a-routes-hub.md` |
| `phases/Phase9B.md` | `docs/plan/phases/phase-09b-ux-polish.md` |
| `docs/route-generation-flow.md` | `docs/features/route-generation.md` |

### Files Deleted

- `rules/claude.md` - Merged into `CLAUDE.md`
- `phases/` directory - Empty after moves

### Files Updated

- `CLAUDE.md` - Merged workflow rules, added source of truth table
- `docs/plan/projectplan.md` - Updated phase links, file structure overview

## Verification

1. All phase links in projectplan.md resolve correctly
2. CLAUDE.md contains complete operating rules
3. spec/ folder unchanged
4. New tracking/features/changes/adr folders have README guides
