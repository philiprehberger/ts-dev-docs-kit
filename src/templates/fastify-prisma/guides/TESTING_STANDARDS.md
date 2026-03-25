# Testing Standards Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide defines testing standards, conventions, and best practices for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [Test Framework Setup](#test-framework-setup)
3. [Test Categories](#test-categories)
4. [File Organization](#file-organization)
5. [Test Structure](#test-structure)
6. [Mocking Guidelines](#mocking-guidelines)
7. [Database Testing](#database-testing)
8. [Coverage Requirements](#coverage-requirements)
9. [Commands Reference](#commands-reference)

---

## Overview

The application uses **Vitest** for testing, which provides excellent TypeScript support, fast execution, and native ESM support.

### Target Metrics

| Metric | Target |
|--------|--------|
| Overall Coverage | 60%+ |
| Critical Features (gateway, credits) | 80%+ |
| Services and Modules | 70%+ |
| Utilities | 60%+ |

---

## Test Framework Setup

### Installing Vitest

```bash
# Install in each workspace that needs testing
cd apps/api
npm install -D vitest @vitest/coverage-v8

# Or in root for all workspaces
npm install -D vitest @vitest/coverage-v8 -w
```

### Vitest Configuration

Create `vitest.config.ts` in each app:

```typescript
// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
    testTimeout: 10000,
  },
});
```

### Test Setup File

```typescript
// apps/api/tests/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/api_marketplace_test',
    },
  },
});

// Run migrations before all tests
beforeAll(async () => {
  // Apply migrations
  // await execSync('npx prisma migrate deploy');
});

// Clean up database between tests
beforeEach(async () => {
  // Truncate all tables
  const tables = ['users', 'tokens', 'credit_transactions', 'usage_logs'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## Test Categories

### Unit Tests

Test individual functions, classes, or modules in isolation.

```typescript
// apps/api/src/lib/token.test.ts
import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from './token';

describe('Token Utils', () => {
  describe('generateToken', () => {
    it('should generate token with correct prefix', () => {
      const token = generateToken();
      expect(token).toMatch(/^mkp_live_[a-zA-Z0-9]{32}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const token = 'mkp_live_test123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('mkp_live_token1');
      const hash2 = hashToken('mkp_live_token2');
      expect(hash1).not.toBe(hash2);
    });
  });
});
```

### Integration Tests

Test multiple components working together.

```typescript
// apps/api/src/modules/credits/credits.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { deductCredits, refundCredits } from './credits-service';

const prisma = new PrismaClient();

describe('Credit System Integration', () => {
  let userId: bigint;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        planId: 1n,
        creditsRemaining: 1000,
        creditResetDay: 1,
      },
    });
    userId = user.id;
  });

  describe('deductCredits', () => {
    it('should deduct credits and create transaction record', async () => {
      const result = await deductCredits(userId, 100, 'test-idempotency-1');

      expect(result).toBe(true);

      // Verify balance
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.creditsRemaining).toBe(900);

      // Verify transaction logged
      const tx = await prisma.creditTransaction.findFirst({
        where: { userId, idempotencyKey: 'test-idempotency-1' },
      });
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(-100);
      expect(tx?.type).toBe('USAGE');
    });

    it('should fail when insufficient credits', async () => {
      const result = await deductCredits(userId, 2000, 'test-idempotency-2');
      expect(result).toBe(false);

      // Verify balance unchanged
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.creditsRemaining).toBe(1000);
    });

    it('should be idempotent', async () => {
      const key = 'test-idempotency-3';

      await deductCredits(userId, 100, key);
      await deductCredits(userId, 100, key); // Duplicate

      // Should only deduct once
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.creditsRemaining).toBe(900);
    });
  });

  describe('refundCredits', () => {
    it('should refund credits and create refund transaction', async () => {
      await deductCredits(userId, 100, 'original');
      await refundCredits(userId, 100, 'original');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.creditsRemaining).toBe(1000);

      const refundTx = await prisma.creditTransaction.findFirst({
        where: { userId, type: 'REFUND' },
      });
      expect(refundTx).toBeDefined();
      expect(refundTx?.amount).toBe(100);
    });
  });
});
```

### API/E2E Tests

Test complete HTTP request/response cycles.

```typescript
// apps/api/src/modules/tokens/tokens.e2e.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { tokensModule } from './index';

describe('Tokens API', () => {
  const app = Fastify();
  let authToken: string;

  beforeAll(async () => {
    await app.register(tokensModule, { prefix: '/tokens' });
    // Get auth token for tests
    authToken = 'test-jwt-token';
  });

  describe('GET /tokens', () => {
    it('should return user tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tokens',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tokens).toBeInstanceOf(Array);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tokens',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /tokens', () => {
    it('should create new token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tokens',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Test Token',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.token).toMatch(/^mkp_live_/);
      expect(body.tokenPrefix).toMatch(/^mkp_live_/);
    });
  });
});
```

---

## File Organization

### Directory Structure

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── index.ts
│   │   │   └── auth.test.ts           # Module tests
│   │   └── credits/
│   │       ├── credits-service.ts
│   │       └── credits-service.test.ts # Service tests
│   ├── lib/
│   │   ├── token.ts
│   │   └── token.test.ts              # Utility tests
│   └── jobs/
│       ├── usage-logger.ts
│       └── usage-logger.test.ts        # Job tests
└── tests/
    ├── setup.ts                        # Test setup
    ├── helpers.ts                      # Test helpers
    └── fixtures/                       # Test data
        ├── users.ts
        └── tokens.ts
```

### Test File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Unit tests | `*.test.ts` | `token.test.ts` |
| Integration tests | `*.test.ts` | `credits-service.test.ts` |
| E2E tests | `*.e2e.test.ts` | `gateway.e2e.test.ts` |

---

## Test Structure

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature/Module Name', () => {
  // Group related tests
  describe('functionName', () => {
    // Setup before each test
    beforeEach(() => {
      // Arrange
    });

    // Cleanup after each test
    afterEach(() => {
      // Cleanup
    });

    it('should do something when condition', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should throw error when invalid input', () => {
      expect(() => doSomething(null)).toThrow('Invalid input');
    });
  });
});
```

### Test Naming Conventions

```typescript
// Good - Descriptive test names
describe('CreditService', () => {
  describe('deductCredits', () => {
    it('should deduct credits successfully with valid balance', () => {});
    it('should fail when insufficient credits', () => {});
    it('should be atomic with transaction rollback on error', () => {});
    it('should prevent duplicate deductions with idempotency key', () => {});
  });
});

// Bad - Vague test names
describe('CreditService', () => {
  it('test1', () => {});
  it('works', () => {});
  it('credits', () => {});
});
```

### Assertions

```typescript
// Basic assertions
expect(value).toBe(5);                    // Strict equality
expect(value).toEqual({ a: 1 });          // Deep equality
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeGreaterThanOrEqual(10);
expect(value).toBeLessThan(10);
expect(value).toBeCloseTo(0.3);           // Floating point

// Strings
expect(string).toContain('substring');
expect(string).toMatch(/regex/);
expect(string).toHaveLength(5);

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(array).toEqual([1, 2, 3]);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('key', 'value');
expect(obj).toMatchObject({ a: 1 });

// Functions
expect(fn).toThrow();
expect(fn).toThrow('error message');
expect(fn).toThrow(ErrorClass);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

---

## Mocking Guidelines

### Mocking Functions

```typescript
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue('result');
mockFn.mockResolvedValue('async result');
mockFn.mockRejectedValue(new Error('error'));

// Verify calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
```

### Mocking Modules

```typescript
// Mock entire module
vi.mock('./module', () => ({
  someFunction: vi.fn(() => 'mocked'),
}));

// Mock specific exports
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  })),
}));
```

### Mocking Prisma

```typescript
import { vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('@prisma/client');

describe('UserService', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 1n,
      email: 'test@example.com',
      creditsRemaining: 1000,
    } as any);
  });

  it('should get user by id', async () => {
    const user = await getUser(1n);
    expect(user).toBeDefined();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1n },
    });
  });
});
```

### Mocking Redis

```typescript
import { vi } from 'vitest';

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));
```

### Spying on Methods

```typescript
import { vi } from 'vitest';

const obj = {
  method: () => 'original',
};

const spy = vi.spyOn(obj, 'method');
spy.mockReturnValue('mocked');

obj.method(); // Returns 'mocked'
expect(spy).toHaveBeenCalled();

spy.mockRestore(); // Restore original
```

---

## Database Testing

### Test Database Setup

```bash
# Create test database
createdb api_marketplace_test

# Set environment variable
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/api_marketplace_test"
```

### Database Factories

```typescript
// tests/factories/user-factory.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `user-${Date.now()}@example.com`,
      planId: 1n,
      creditsRemaining: 1000,
      creditResetDay: 1,
      ...overrides,
    },
  });
}

export async function createToken(userId: bigint, overrides = {}) {
  return prisma.token.create({
    data: {
      userId,
      name: 'Test Token',
      tokenHash: `hash-${Date.now()}`,
      tokenPrefix: `mkp_live_${Date.now()}`,
      ...overrides,
    },
  });
}
```

### Using Factories

```typescript
import { createUser, createToken } from '../factories';

describe('Token Management', () => {
  it('should create token for user', async () => {
    const user = await createUser({ email: 'specific@example.com' });
    const token = await createToken(user.id, { name: 'My Token' });

    expect(token.userId).toBe(user.id);
    expect(token.name).toBe('My Token');
  });
});
```

### Transaction Rollback

```typescript
// Wrap tests in transaction and rollback
import { beforeEach, afterEach } from 'vitest';

beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

---

## Coverage Requirements

### Target Coverage

| Area | Target | Priority |
|------|--------|----------|
| Gateway module | 80%+ | Critical |
| Credit system | 80%+ | Critical |
| Authentication | 75%+ | High |
| Token management | 70%+ | High |
| API modules | 60%+ | Medium |
| Utilities | 60%+ | Medium |

### Running Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.e2e.test.ts',
        'src/**/types.ts',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
```

---

## Commands Reference

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Run specific test file
npm run test src/lib/token.test.ts

# Run tests matching pattern
npm run test -t "credit"

# Run with coverage
npm run test:coverage

# Run E2E tests only
npm run test -- --grep="\.e2e\.test\.ts$"

# Run in UI mode
npm run test:ui

# Run in specific workspace
npm run test --filter=@api-marketplace/api
```

---

## Best Practices

### Do

- Write tests before or alongside code (TDD)
- Test behavior, not implementation
- Use descriptive test names
- Keep tests independent and isolated
- Use factories for test data
- Mock external dependencies
- Test edge cases and error paths
- Aim for high coverage on critical paths

### Don't

- Test implementation details
- Share state between tests
- Use real external services (APIs, email)
- Write tests that depend on execution order
- Skip cleanup in afterEach hooks
- Commit failing tests
- Mock everything (test real integration where appropriate)

---

## Related Documentation

- [Vitest Documentation](https://vitest.dev)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [DATABASE_PATTERNS.md](./DATABASE_PATTERNS.md)
- [API_STANDARDS.md](./API_STANDARDS.md)
