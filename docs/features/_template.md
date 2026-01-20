# Feature Name

## Overview

Brief description of what this feature does and why it exists.

## Architecture

### Components Involved

- `src/screens/...` - UI layer
- `src/services/...` - API/service layer
- `src/store/...` - State management

### Data Flow

```
User Action
    |
    v
Component -> Store -> Service -> API
    ^                              |
    |______________________________|
```

## Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `src/...` | Description |

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `functionName()` | `file.ts:123` | What it does |

## API Integration

If applicable, document external API usage:

- **Endpoint**: `GET /api/...`
- **Auth**: Required/Not required
- **Rate limits**: X requests/minute

## Data Structures

```typescript
interface ExampleType {
  id: string;
  // ...
}
```

## Error Handling

How errors are handled and what users see.

## Testing

How to test this feature manually.

## Known Limitations

- Limitation 1
- Limitation 2

## Future Improvements

- Potential enhancement 1
- Potential enhancement 2
