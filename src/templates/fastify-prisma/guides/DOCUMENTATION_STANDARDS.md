# Documentation Standards

Guidelines for creating and maintaining API Marketplace documentation.

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

---

## Purpose

Consistent, high-quality documentation that serves developers and project maintainers effectively.

---

## General Principles

### 1. Clarity First
- Use simple, direct language
- Avoid jargon unless explained
- Include examples for complex concepts

### 2. Maintainability
- Keep docs close to code they describe
- Update docs with code changes
- Use templates for consistency

### 3. Accessibility
- Provide table of contents for long docs
- Link related documentation
- Use descriptive headings

---

## Document Structure

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Top-level docs | SCREAMING_SNAKE_CASE | `DOCUMENTATION_STANDARDS.md` |
| Guides | SCREAMING_SNAKE_CASE | `NAMING_CONVENTIONS.md` |
| Plans | number-kebab-case | `017-standards-and-guides.md` |
| Backlog | number-kebab-case | `028-third-party-integrations.md` |
| Completion Reports | date-kebab-case | `2026-01-25-feature-name.md` |
| Issues | number-kebab-case | `001-login-bug.md` |
| Templates | SCREAMING_SNAKE_CASE | `PLAN_TEMPLATE.md` |

### Front Matter

Every document should start with:

```markdown
# Document Title

Brief description (1-2 sentences).

**Last Updated**: YYYY-MM-DD
**Status**: Draft | Active | Deprecated
**Audience**: Developers | Everyone

---
```

### Table of Contents

Required for docs over 200 lines:

```markdown
## Table of Contents

- [Section 1](#section-1)
- [Section 2](#section-2)
  - [Subsection](#subsection)
```

---

## Content Guidelines

### Headings

- Use ATX-style (`#`) not underline-style
- One H1 per document (title)
- Hierarchical: H1 -> H2 -> H3
- No skipping levels (H2 -> H4)

```markdown
# Title (H1)
## Main Section (H2)
### Subsection (H3)
#### Detail (H4, use sparingly)
```

### Code Blocks

Always specify language:

````markdown
```typescript
const user = await prisma.user.findUnique({ where: { id } });
```
````

Include comments for complex code:

````markdown
```typescript
// Fetch user with related tokens using eager loading
const user = await prisma.user.findUnique({
  where: { id },
  include: { tokens: true },
});
```
````

### Examples

- Provide complete, runnable examples
- Include expected output
- Show both success and error cases

````markdown
### Example: Create API

**Code:**
```typescript
const api = await prisma.api.create({
  data: {
    name: 'Weather API',
    slug: 'weather-api',
    baseUrl: 'https://api.weather.com',
  },
});
```

**Result:**
```typescript
{
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Weather API',
  slug: 'weather-api',
  baseUrl: 'https://api.weather.com',
  createdAt: 2026-03-25T10:00:00.000Z
}
```
````

### Links

- Use relative links within docs: `[Guide](./NAMING_CONVENTIONS.md)`
- Use descriptive link text: `[Naming Conventions](./NAMING_CONVENTIONS.md)` not `[Click here](./NAMING_CONVENTIONS.md)`
- Verify links are not broken

### Lists

- Use `-` for unordered lists
- Use `1.` for ordered lists (auto-numbering)
- Indent sub-items with 2 spaces

```markdown
- Item 1
  - Sub-item 1.1
  - Sub-item 1.2
- Item 2

1. Step one
2. Step two
   - Note about step two
3. Step three
```

### Tables

- Use for structured data
- Keep columns reasonably sized
- Include headers

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |
```

---

## Document Types

### Guide

```markdown
# Guide Title

Brief overview of what this guide covers.

## Prerequisites
- Required knowledge
- Required setup

## Topics
### Topic 1
Explanation + examples

### Topic 2
Explanation + examples

## Related Documentation
- Links to related docs
```

### Plan

Plans follow a lifecycle: **Backlog → Active → Archive (+Report)**

| Location | Purpose |
|----------|---------|
| `docs/plans/backlog/` | Defined plans waiting to be prioritized |
| `docs/plans/` | Active plans currently being worked on |
| `docs/plans/archive/` | Completed plans |
| `docs/plans/reports/` | Admin-facing completion summaries |

**Templates** (in `docs/plans/templates/`):
- `PLAN_TEMPLATE.md` - Full template for complex, multi-phase features
- `PLAN_TEMPLATE_SIMPLE.md` - Lightweight template for simple fixes
- `COMPLETION_REPORT_TEMPLATE.md` - Admin-facing summary after completion

**Plan numbering**: Sequential across all directories. Find highest number in `docs/plans/`, `docs/plans/archive/`, and `docs/plans/backlog/`, then use the next number.

Basic plan structure:

```markdown
# Plan XXX: Title

**Created**: YYYY-MM-DD
**Status**: Planned | In Progress | Complete
**Priority**: High | Medium | Low
**Estimated Effort**: Small | Medium | Large

---

## Overview
Goals and scope

## Current State
What exists vs gaps

## Implementation
### Phase 1: Name
- [ ] Task 1
- [ ] Task 2

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Files Summary
- Files to create/modify
```

### Completion Report

Created after plan completion for **admin users** (not developers). Explains what's new and how to use it.

**Location**: `docs/plans/reports/YYYY-MM-DD-feature-name.md`

```markdown
# Completion Report: Feature Name

**Release Date**: YYYY-MM-DD
**Plan Reference**: [Plan XXX](../archive/xxx-plan-name.md)

## Summary
2-3 sentence overview for admins

## What's New
- Feature descriptions with navigation paths

## How to Use
Step-by-step instructions

## Changes to Existing Features
Before/after table

## Known Limitations
What doesn't work yet
```

### Issue

```markdown
# Issue XXX: Title

## Problem
Description of the issue

## Steps to Reproduce
1. Step 1
2. Step 2

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Solution
How it was fixed (after resolution)
```

---

## Style Guide

### Voice

- **Active voice**: "Run the command" not "The command should be run"
- **Second person**: "You can configure..." not "One can configure..."
- **Present tense**: "The function returns..." not "The function will return..."

### Formatting

- **Bold** for emphasis and UI elements
- `Code` for inline code, file names, commands
- *Italics* sparingly for introducing terms

### Capitalization

- Sentence case for headings: "Getting started" not "Getting Started"
- Exception: Proper nouns (TypeScript, Fastify, Next.js, Prisma, PostgreSQL, Redis)

---

## Code Examples

### Quality Standards

- **Tested**: Examples should actually work
- **Complete**: Include necessary imports
- **Realistic**: Use realistic variable names
- **Commented**: Explain non-obvious parts

### Good Example

```typescript
// apps/api/src/services/credit-service.ts
import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';

export class CreditService {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  /**
   * Deduct credits from user balance atomically.
   * Returns true if deduction successful, false if insufficient credits.
   */
  async deductCredits(
    userId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      // Check for existing transaction with this key
      const existing = await tx.creditTransaction.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        this.logger.info({ idempotencyKey }, 'Duplicate transaction detected');
        return false;
      }

      // Get current balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsRemaining: true },
      });

      if (!user || user.creditsRemaining < amount) {
        return false;
      }

      // Deduct credits
      await tx.user.update({
        where: { id: userId },
        data: { creditsRemaining: { decrement: amount } },
      });

      // Record transaction
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: 'USAGE',
          idempotencyKey,
        },
      });

      return true;
    });
  }
}
```

### Bad Example

```typescript
// Bad: Incomplete, unclear, no error handling
async function deduct(user, amt) {
  await db.query("UPDATE users SET credits = credits - " + amt);
  return true;
}
```

---

## Maintenance

### When to Update

- **Immediately**: When code changes break docs
- **Same commit**: Feature docs with feature code
- **Per release**: Update CHANGELOG

### Update Checklist

- [ ] Update "Last Updated" date
- [ ] Verify code examples still work
- [ ] Check links are not broken
- [ ] Update cross-references

### Deprecation

When deprecating docs:

1. Add warning at top:
   ```markdown
   > **DEPRECATED**: This document is outdated. See [New Doc](NEW_DOC.md) instead.
   ```

2. Move to archive (optional)

3. Update links pointing to it

---

## Anti-Patterns

### Don't

- Write documentation after the fact
- Assume reader knowledge
- Use ambiguous pronouns ("it", "this")
- Leave TODOs in published docs
- Use "obviously" or "simply"

### Do

- Document as you code
- Explain prerequisites
- Be specific and clear
- Complete before publishing
- Respect the reader

---

## Related Documentation

- [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [DOCS_GUIDE.md](../DOCS_GUIDE.md)
- [Plans Index](../plans/INDEX.md) - Active plans and lifecycle
- [Backlog Index](../plans/backlog/INDEX.md) - Planned but not active
- [Plan Templates](../plans/templates/) - Templates for plans and reports
