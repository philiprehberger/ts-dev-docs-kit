# Documentation Guide

This guide explains how to write and organize documentation in the `docs/` directory.

---

## Directory Structure

```
docs/
├── DOCS_GUIDE.md              # This file
├── guides/                     # Development guides
│   ├── INDEX.md               # Guide index/table of contents
│   ├── CONTRIBUTING.md        # Contribution guidelines
│   ├── NAMING_CONVENTIONS.md  # Naming standards
│   ├── features/              # Feature-specific guides
│   └── ...                    # Other guides
├── plans/                      # Development plans
│   ├── templates/             # Plan templates
│   ├── backlog/               # Planned work
│   ├── archive/               # Completed plans
│   └── reports/               # Completion reports
└── issues/                     # Issue tracking
    ├── XXX-issue-name.md      # Active issues
    └── resolved/              # Resolved issues
```

---

## Document Types

### Guides (`docs/guides/`)

**Purpose**: Explain HOW to do things in the codebase.

**Naming**: `SCREAMING_SNAKE_CASE.md` for top-level guides, `kebab-case.md` for feature guides

**Structure**:
```markdown
# Guide Title

**Last Updated**: YYYY-MM-DD
**Status**: Active|Draft|Deprecated
**Audience**: Developers|Admins|All

Brief description of what this guide covers.

---

## Table of Contents

1. [Section 1](#section-1)
2. [Section 2](#section-2)

---

## Section 1

Content...

## Section 2

Content...

---

## Related Documentation

- [Other Guide](./OTHER_GUIDE.md)
```

**Examples**:
- `TESTING_STANDARDS.md` - How to write tests
- `DATABASE_PATTERNS.md` - Database best practices
- `features/credit-system.md` - Credit system feature guide

### Plans (`docs/plans/`)

**Purpose**: Define WHAT to build and WHY.

**Naming**: `NNN-descriptive-name.md` (numbered sequentially)

**Templates**:
- Use `templates/PLAN_TEMPLATE.md` for complex features
- Use `templates/PLAN_TEMPLATE_SIMPLE.md` for bug fixes/small changes

**Lifecycle**:
1. Create in `backlog/` when defined
2. Move to root `plans/` when starting work
3. Move to `archive/` when complete
4. Create report in `reports/` for significant features

### Issues (`docs/issues/`)

**Purpose**: Track bugs, errors, and problems encountered.

**Naming**: `NNN-short-description.md` (numbered sequentially)

**Structure**:
```markdown
# Issue #NNN: [Short Description]

**Status**: Active|Investigating|Resolved
**Created**: YYYY-MM-DD
**Resolved**: YYYY-MM-DD
**Severity**: Critical|High|Medium|Low

---

## Problem

Description of the issue/error encountered.

## Steps to Reproduce

1. Step 1
2. Step 2
3. Step 3

## Expected Behavior

What should happen.

## Actual Behavior

What actually happens.

## Error Messages

```
Error logs/messages here
```

## Investigation

### Findings
- Finding 1
- Finding 2

### Root Cause
Explanation of what's causing the issue.

## Solution

### Changes Made
- File: `path/to/file.ts`
  - Changed X to Y
  - Reason: ...

### Testing
- [ ] Issue reproduced
- [ ] Fix applied
- [ ] Issue no longer occurs
- [ ] No regressions

## Related

- Related to: [Plan #123](../plans/archive/123-plan-name.md)
- Similar to: [Issue #45](./resolved/045-similar-issue.md)
```

**Lifecycle**:
1. Create in `docs/issues/` when problem discovered
2. Update with investigation findings
3. Update with solution when fixed
4. Move to `docs/issues/resolved/` when complete

### Feature Guides (`docs/guides/features/`)

**Purpose**: Document specific features for users/developers.

**Naming**: `kebab-case.md` (e.g., `credit-system.md`, `api-gateway.md`)

**Structure**:
```markdown
# Feature Name

**Last Updated**: YYYY-MM-DD
**Status**: Active
**Related Plan**: [Plan #123](../../plans/archive/123-plan-name.md)

Brief overview of the feature.

---

## Overview

What this feature does and why it exists.

## User Guide

### How to Use
Step-by-step guide for end users.

### Access Points
- UI: Where to find this in the interface
- API: Relevant endpoints

## Technical Details

### Architecture
How it's built and how it works.

### Database Schema
Relevant models and relationships.

### API Endpoints
- `POST /v1/resource` - Description
- `GET /v1/resource/:id` - Description

### Key Files
- `apps/api/src/modules/feature/` - Backend implementation
- `apps/web/app/feature/` - Frontend pages
- `packages/shared/src/types.ts` - Shared types

## Configuration

Environment variables and settings.

## Examples

Code examples and usage scenarios.

## Troubleshooting

Common issues and solutions.

## Related Documentation

- [Related Guide](../RELATED_GUIDE.md)
- [API Standards](../API_STANDARDS.md)
```

---

## Writing Standards

### General Guidelines

- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date with code changes
- Use absolute paths for cross-references: `[Guide](../guides/GUIDE.md)`
- Include "Last Updated" dates in guides
- Add "Related Documentation" sections to help navigation

### Markdown Conventions

```markdown
# Top-level heading (H1) - Only one per document

## Section heading (H2)

### Subsection heading (H3)

**Bold** for emphasis
*Italic* for subtle emphasis
`inline code` for code references
```

### Code Blocks

Use language identifiers for syntax highlighting:

````markdown
```typescript
// TypeScript code
const user = await prisma.user.findUnique({ where: { id } });
```

```bash
# Shell commands
npm run dev
```

```prisma
// Prisma schema
model User {
  id    BigInt @id @default(autoincrement())
  email String @unique
}
```
````

### Links

- Internal docs: Use relative paths `[Guide](../guides/GUIDE.md)`
- External links: Use absolute URLs `[Fastify](https://fastify.dev)`
- Anchor links: `[Section](#section-name)` (lowercase, hyphenated)

---

## Maintenance

### When to Update Documentation

- **Immediately**: When implementing features mentioned in guides
- **During code review**: Before merging PRs that change documented behavior
- **Weekly**: Review and update dates on recently modified guides
- **Quarterly**: Audit all guides for accuracy and relevance

### Deprecating Documentation

When a feature is removed or significantly changed:

1. Update the guide with **Status**: Deprecated
2. Add deprecation notice at the top
3. Reference replacement guide/feature
4. Keep for 3 months before archiving

### Documentation Checklist

When creating new features:

- [ ] Create or update feature guide in `docs/guides/features/`
- [ ] Update `docs/guides/INDEX.md` with new guide
- [ ] Update related guides that reference this feature
- [ ] Include usage examples
- [ ] Document API endpoints
- [ ] Document configuration options
- [ ] Create plan completion report if significant

---

## Related Documentation

- [Contributing Guide](./guides/CONTRIBUTING.md)
- [Documentation Standards](./guides/DOCUMENTATION_STANDARDS.md)
