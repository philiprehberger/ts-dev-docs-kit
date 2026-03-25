# Plan #XXX: [Feature Name]

**Status**: Active
**Priority**: [High/Medium/Low]
**Estimated Effort**: [Small/Medium/Large]
**Created**: YYYY-MM-DD
**Started**: YYYY-MM-DD
**Completed**:

---

## Overview

Brief description of what this plan aims to accomplish and why it's needed.

## Goals

- [ ] Primary goal 1
- [ ] Primary goal 2
- [ ] Primary goal 3

## Background

Context, motivation, and any relevant history leading to this plan.

## Scope

### In Scope
- Feature/change 1
- Feature/change 2
- Feature/change 3

### Out of Scope
- What this plan explicitly will NOT address
- Items deferred to future plans

## Technical Design

### Architecture Changes

Describe any architectural changes, new patterns, or significant design decisions.

### Database Changes

```prisma
// Schema changes if applicable
```

### API Changes

**New Endpoints:**
- `POST /v1/resource` - Description
- `GET /v1/resource/:id` - Description

**Modified Endpoints:**
- `PUT /v1/resource/:id` - What changed

### Frontend Changes

Describe UI/UX changes, new pages/components, user flows.

## Implementation Plan

### Phase 1: Foundation
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Phase 2: Core Features
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Phase 3: Polish & Testing
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Files Changed

### Backend (`apps/api/`)
- `src/modules/new-feature/index.ts` - Created
- `src/lib/utility.ts` - Modified
- `prisma/schema.prisma` - Modified

### Frontend (`apps/web/`)
- `app/new-page/page.tsx` - Created
- `components/new-component.tsx` - Created

### Shared (`packages/shared/`)
- `src/types.ts` - Modified

## Testing Strategy

- [ ] Unit tests for services/utilities
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows
- [ ] Manual testing checklist

## Security Considerations

- Authentication/authorization requirements
- Input validation
- Rate limiting
- Data access controls

## Performance Considerations

- Expected load/scale
- Caching strategy
- Database query optimization
- Background job processing

## Deployment Notes

- Environment variables to add
- Database migrations to run
- Manual steps required
- Rollback plan

## Documentation

- [ ] Update feature guide in `docs/guides/features/`
- [ ] Update API documentation
- [ ] Update README if needed
- [ ] Create completion report

## Dependencies

- Depends on: [Plan #XXX](../XXX-plan-name.md)
- Blocks: [Plan #YYY](../backlog/YYY-plan-name.md)

## Open Questions

- [ ] Question 1 - **Decision**: TBD
- [ ] Question 2 - **Decision**: TBD

## Notes

Any additional notes, decisions, or context gathered during implementation.

---

## Completion Checklist

- [ ] All implementation tasks completed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to production
- [ ] Feature guide created/updated
- [ ] Completion report written
- [ ] Plan moved to archive
