# Contributing Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

Thank you for contributing to the API Marketplace project! This document provides guidelines and best practices for contributing.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Commit Guidelines](#commit-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Testing Requirements](#testing-requirements)
7. [Documentation](#documentation)

---

## Getting Started

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 10+
- Docker & Docker Compose
- Git

### Setup Development Environment

```bash
# Clone repository
git clone <repository-url>
cd api-marketplace-app

# Install dependencies (turborepo handles all workspaces)
npm install

# Copy environment file
cp .env.example .env

# Configure .env with your settings
# DATABASE_URL, REDIS_URL, JWT_SECRET, etc.

# Start infrastructure services
docker-compose up -d

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start all services in development mode
npm run dev
```

### Verify Setup

```bash
# Check API server
curl http://localhost:4000/health/live

# Check web app
curl http://localhost:3000

# Run tests
npm run test

# Run linting
npm run lint
```

### Running Individual Apps

```bash
# Run only API server
npm run dev --filter=@api-marketplace/api

# Run only web frontend
npm run dev --filter=@api-marketplace/web

# Build specific app
npm run build --filter=@api-marketplace/api
```

---

## Development Workflow

### 1. Create a Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/token-revocation` |
| `fix/` | Bug fixes | `fix/credit-deduction-race` |
| `refactor/` | Code refactoring | `refactor/gateway-module` |
| `docs/` | Documentation | `docs/api-guide` |
| `test/` | Test additions | `test/credit-transactions` |
| `chore/` | Maintenance | `chore/update-dependencies` |

### 2. Make Changes

- Write clean, readable TypeScript code
- Follow existing patterns and conventions
- Add JSDoc comments for complex logic
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run all tests
npm run test

# Run tests for specific app
npm run test --filter=@api-marketplace/api

# Run linting
npm run lint

# Fix linting issues
npm run lint -- --fix

# Type check
npx turbo run lint  # Uses TypeScript's tsc --noEmit
```

### 4. Commit Your Changes

See [Commit Guidelines](#commit-guidelines) below.

### 5. Push and Create Pull Request

```bash
# Push to remote
git push origin feature/your-feature-name

# Create PR via GitHub UI
```

---

## Code Standards

### TypeScript

- Use strict mode (enabled in `tsconfig.json`)
- Provide explicit types for parameters and return values
- Avoid `any` types (use `unknown` if needed)
- Use `const` by default, `let` when mutation needed
- Never use `var`

```typescript
// Good - Explicit types, const
async function getUser(id: bigint): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
}

// Bad - No types, implicit any
async function getUser(id) {
  let user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
}
```

### Fastify Modules

```typescript
// Good - Type-safe Fastify module
import type { FastifyInstance } from 'fastify';

export async function tokensModule(app: FastifyInstance) {
  app.get('/tokens', async (request, reply) => {
    const userId = request.user.id;
    const tokens = await prisma.token.findMany({
      where: { userId, deletedAt: null },
    });
    return { tokens };
  });
}
```

### React/Next.js Components

```typescript
// Good - Typed component with interface
interface UserCardProps {
  user: User;
  showActions?: boolean;
}

export function UserCard({ user, showActions = false }: UserCardProps) {
  return (
    <div className="card">
      <h3>{user.email}</h3>
      {showActions && <button>Edit</button>}
    </div>
  );
}

// Bad - No types
export function UserCard({ user, showActions }) {
  // ...
}
```

### Error Handling

```typescript
// Good - Type-safe error handling
try {
  const result = await performOperation();
  return result;
} catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new Error('Unique constraint violation');
    }
  }
  app.log.error(error);
  throw error;
}

// Use custom error classes
class InsufficientCreditsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}
```

### Async/Await

```typescript
// Good - Use async/await
async function getTokens(userId: bigint): Promise<Token[]> {
  const tokens = await prisma.token.findMany({
    where: { userId },
  });
  return tokens;
}

// Avoid - Raw promises
function getTokens(userId: bigint): Promise<Token[]> {
  return prisma.token.findMany({
    where: { userId },
  }).then(tokens => tokens);
}
```

---

## Commit Guidelines

### Commit Message Format

```
Type: Brief description (50 chars max)

Detailed explanation if needed (wrap at 72 chars).
Can span multiple lines.

Refs #123
```

### Commit Types

| Type | Description |
|------|-------------|
| `Add:` | New feature |
| `Fix:` | Bug fix |
| `Update:` | Update existing feature |
| `Refactor:` | Code refactoring |
| `Docs:` | Documentation changes |
| `Test:` | Test additions/modifications |
| `Chore:` | Maintenance tasks |
| `Perf:` | Performance improvements |

### Examples

```bash
# Good
git commit -m "Add: token revocation endpoint"
git commit -m "Fix: credit deduction race condition in gateway"
git commit -m "Update: improve rate limiting algorithm"
git commit -m "Docs: add gateway flow diagram"

# Bad
git commit -m "updated stuff"
git commit -m "fix"
git commit -m "WIP"
```

### Commit Best Practices

- One logical change per commit
- Write clear, descriptive messages
- Reference issue numbers when applicable
- Don't commit broken code
- Don't commit `console.log` or debug code
- Don't commit secrets or API keys

---

## Pull Request Process

### Before Creating PR

1. **Code Complete**
   - [ ] Feature fully implemented
   - [ ] Tests written and passing
   - [ ] No linting errors
   - [ ] No type errors
   - [ ] All `console.log` removed

2. **Documentation Updated**
   - [ ] JSDoc comments added
   - [ ] Feature guide created/updated
   - [ ] API docs updated (if API changed)
   - [ ] README updated (if needed)

3. **Tests Passing**
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Branch Updated**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
[Add screenshots here]

## Related Issues
Fixes #123
```

### Review Process

1. **For PR Authors**
   - Respond to feedback promptly
   - Make requested changes
   - Re-request review after changes
   - Keep PRs focused (< 500 lines preferred)

2. **For Reviewers**
   - Review within 24-48 hours
   - Be constructive in feedback
   - Test changes locally if possible
   - Check for security issues

---

## Testing Requirements

### Test Coverage Targets

| Area | Target |
|------|--------|
| Critical features (gateway, credits) | 80%+ |
| Services | 70%+ |
| Modules | 60%+ |
| Overall | 60%+ |

### Required Tests

- **New features**: Unit + integration tests required
- **Bug fixes**: Test that reproduces bug
- **API changes**: API endpoint tests required
- **Critical paths**: E2E tests recommended

### Test Structure

```typescript
// Good test structure
describe('CreditService', () => {
  describe('deductCredits', () => {
    it('should deduct credits successfully with valid balance', async () => {
      // Arrange
      const userId = 1n;
      const cost = 100;

      // Act
      const result = await creditService.deductCredits(userId, cost);

      // Assert
      expect(result).toBe(true);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user.creditsRemaining).toBe(900);
    });

    it('should fail when insufficient credits', async () => {
      // ...
    });

    it('should be atomic with transaction rollback', async () => {
      // ...
    });
  });
});
```

### Running Tests

```bash
# All tests
npm run test

# Specific workspace
npm run test --filter=@api-marketplace/api

# Watch mode (for development)
cd apps/api
npm run test -- --watch

# With coverage
npm run test -- --coverage
```

---

## Documentation

### When to Update Docs

- Adding new features
- Changing API endpoints
- Modifying configuration
- Changing workflows
- Adding environment variables

### Documentation Files

```
docs/
├── DOCS_GUIDE.md          # Documentation standards
├── guides/                # Development guides
│   ├── INDEX.md
│   ├── CONTRIBUTING.md    # This file
│   ├── NAMING_CONVENTIONS.md
│   ├── DATABASE_PATTERNS.md
│   └── features/          # Feature-specific guides
├── plans/                 # Implementation plans
│   ├── templates/         # Plan templates
│   ├── backlog/           # Planned work
│   ├── archive/           # Completed plans
│   └── reports/           # Completion reports
└── issues/                # Issue tracking
    └── resolved/          # Resolved issues
```

### Code Comments

```typescript
// Good - Explains why
// Use Redis cache to reduce database load during high traffic.
// Token lookups happen on every gateway request.
const token = await redis.get(`token:${hash}`);

// Bad - Explains what (obvious from code)
// Get token from Redis
const token = await redis.get(`token:${hash}`);
```

### JSDoc Comments

```typescript
/**
 * Deducts credits from a user or organization atomically.
 *
 * @param userId - The user ID to deduct from
 * @param cost - Number of credits to deduct
 * @param idempotencyKey - Unique key to prevent duplicate deductions
 * @returns True if successful, false if insufficient credits
 * @throws {Error} If database transaction fails
 */
async function deductCredits(
  userId: bigint,
  cost: number,
  idempotencyKey: string,
): Promise<boolean> {
  // ...
}
```

---

## Best Practices

### Do

- Write self-documenting code with clear names
- Keep functions small and focused (< 50 lines)
- Use meaningful variable names
- Handle errors gracefully with proper types
- Write tests for new features
- Follow existing patterns in the codebase
- Use strict TypeScript settings
- Review your own PR before requesting review

### Don't

- Commit sensitive data (API keys, passwords, tokens)
- Commit commented-out code
- Commit `console.log`, `debugger`, or debug code
- Push directly to main
- Skip testing
- Ignore linting or type errors
- Make massive PRs (> 1000 lines)
- Use `any` type unless absolutely necessary
- Disable TypeScript strict checks

---

## Getting Help

### Resources

- [Fastify Documentation](https://fastify.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Project README](../../README.md)
- [Development Guides](./INDEX.md)

### Questions?

- Check existing documentation
- Search closed issues/PRs
- Ask in team chat
- Create a discussion issue

---

## Code of Conduct

### Expected Behavior

- Be respectful and professional
- Accept constructive criticism gracefully
- Focus on what is best for the project
- Show empathy towards others
- Write inclusive, accessible code

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Publishing private information
- Unprofessional conduct

---

**Thank you for contributing!**
