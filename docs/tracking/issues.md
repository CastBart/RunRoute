# Known Issues

## Open Issues

### [I-001] Background tracking not verified on device
- **Priority**: P1
- **Status**: Open
- **Description**: Background location tracking implemented but not tested on physical devices
- **Reproduction**: N/A - requires physical device testing
- **Affected platforms**: iOS, Android
- **Notes**: May need platform-specific adjustments for battery optimization

### [I-002] State management differs from spec
- **Priority**: P2 (Decision needed)
- **Status**: Open
- **Description**: Using Zustand instead of spec'd Redux Toolkit
- **Impact**: Low - Zustand works well, but differs from original specification
- **Decision**: Keep Zustand (simpler) or migrate to Redux (per spec)?

## Resolved Issues

*Issues move here when fixed. Reference the change note that resolved them.*

---

## Issue Template

When adding new issues, use this format:

```markdown
### [I-XXX] Brief title
- **Priority**: P0/P1/P2/P3
- **Status**: Open/In Progress/Resolved
- **Description**: What's wrong
- **Reproduction**: Steps to reproduce
- **Affected platforms**: iOS/Android/Both
- **Notes**: Additional context
```
