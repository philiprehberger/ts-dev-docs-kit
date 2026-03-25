# Service Patterns Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents service patterns and best practices for organizing business logic in the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use Services](#when-to-use-services)
3. [Service Structure](#service-structure)
4. [Service Patterns](#service-patterns)
5. [Dependency Injection](#dependency-injection)
6. [Error Handling](#error-handling)
7. [Testing Services](#testing-services)

---

## Overview

Services encapsulate business logic that doesn't belong in route handlers or database models. They provide clean separation of concerns and make code more testable and reusable.

### Service vs Route Handler vs Repository

| Layer | Responsibility | Example |
|-------|---------------|---------|
| Route Handler | HTTP concerns, validation, responses | Parse request, validate, return JSON |
| Service | Business logic, orchestration | Calculate costs, process transactions |
| Repository/Prisma | Data access, queries | Query database, manage transactions |

---

## When to Use Services

### Use a Service When

- Logic involves multiple models/entities
- Logic is reused across routes
- Complex business rules need encapsulation
- External API calls are involved
- Transactions span multiple operations
- Logic needs to be testable independently

### Keep in Route Handler When

- Simple CRUD operations
- Single model operations
- No business logic beyond validation
- Straightforward data retrieval

### Examples

```typescript
// Simple CRUD - Keep in route handler
app.get('/users/:id', async (request, reply) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(request.params.id) },
  });

  if (!user) {
    throw app.httpErrors.notFound('User not found');
  }

  return user;
});

// Complex logic - Use a service
app.post('/users/:id/deduct-credits', async (request, reply) => {
  const result = await creditService.deductCredits(
    BigInt(request.params.id),
    request.body.amount,
    request.body.idempotencyKey
  );

  return { success: result };
});
```

---

## Service Structure

### Functional Service (Recommended for Simple Cases)

```typescript
// apps/api/src/services/token-service.ts
import { PrismaClient } from '@prisma/client';
import { generateToken, hashToken } from '../lib/token';
import type { Logger } from 'pino';

const prisma = new PrismaClient();

export interface CreateTokenInput {
  userId: bigint;
  name: string;
  expiresAt?: Date;
  permissions?: { apiId: bigint }[];
}

export interface TokenResult {
  id: bigint;
  token: string;  // Raw token (only returned once)
  tokenPrefix: string;
  tokenHash: string;
}

export async function createToken(
  input: CreateTokenInput,
  logger?: Logger
): Promise<TokenResult> {
  logger?.info({ userId: input.userId }, 'Creating token');

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = rawToken.substring(0, 16);

  const token = await prisma.token.create({
    data: {
      userId: input.userId,
      name: input.name,
      tokenHash,
      tokenPrefix,
      expiresAt: input.expiresAt,
      permissions: input.permissions
        ? {
            create: input.permissions,
          }
        : undefined,
    },
  });

  logger?.info({ tokenId: token.id }, 'Token created');

  return {
    id: token.id,
    token: rawToken,
    tokenPrefix,
    tokenHash,
  };
}

export async function revokeToken(
  tokenId: bigint,
  userId: bigint,
  logger?: Logger
): Promise<boolean> {
  logger?.info({ tokenId, userId }, 'Revoking token');

  const result = await prisma.token.updateMany({
    where: {
      id: tokenId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const revoked = result.count > 0;
  logger?.info({ tokenId, revoked }, 'Token revocation attempt');

  return revoked;
}
```

### Class-Based Service (Recommended for Complex Logic)

```typescript
// apps/api/src/services/credit-service.ts
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { InsufficientCreditsError } from '../lib/errors';

export class CreditService {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  async deductCredits(
    userId: bigint,
    amount: number,
    idempotencyKey: string
  ): Promise<boolean> {
    this.logger.info({ userId, amount, idempotencyKey }, 'Starting credit deduction');

    try {
      await this.prisma.$transaction(async (tx) => {
        // Check for existing transaction (idempotency)
        const existing = await tx.creditTransaction.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          this.logger.info({ idempotencyKey }, 'Duplicate request, skipping');
          return;
        }

        // Get user with lock
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error('User not found');
        }

        if (user.creditsRemaining < amount) {
          throw new InsufficientCreditsError(amount, user.creditsRemaining);
        }

        // Deduct credits
        await tx.user.update({
          where: { id: userId },
          data: {
            creditsRemaining: {
              decrement: amount,
            },
          },
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
      });

      this.logger.info({ userId, amount }, 'Credit deduction successful');
      return true;
    } catch (error) {
      this.logger.error({ err: error, userId, amount }, 'Credit deduction failed');
      throw error;
    }
  }

  async refundCredits(
    userId: bigint,
    amount: number,
    referenceKey: string
  ): Promise<void> {
    this.logger.info({ userId, amount, referenceKey }, 'Starting credit refund');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: {
            increment: amount,
          },
        },
      }),
      this.prisma.creditTransaction.create({
        data: {
          userId,
          amount,
          type: 'REFUND',
          description: `Refund for ${referenceKey}`,
        },
      }),
    ]);

    this.logger.info({ userId, amount }, 'Credit refund successful');
  }

  async getBalance(userId: bigint): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditsRemaining: true },
    });

    return user?.creditsRemaining ?? 0;
  }

  async getTransactionHistory(
    userId: bigint,
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = options;

    return this.prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}

// Factory function for dependency injection
export function createCreditService(
  prisma: PrismaClient,
  logger: Logger
): CreditService {
  return new CreditService(prisma, logger);
}
```

---

## Service Patterns

### Repository Pattern (Data Access Layer)

```typescript
// apps/api/src/repositories/user-repository.ts
import { PrismaClient, User } from '@prisma/client';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: {
    email: string;
    planId: bigint;
    creditsRemaining: number;
    creditResetDay: number;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async updateCredits(userId: bigint, amount: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        creditsRemaining: {
          increment: amount,
        },
      },
    });
  }
}
```

### Manager Pattern (Orchestration)

```typescript
// apps/api/src/services/api-gateway-manager.ts
import type { Logger } from 'pino';
import { CreditService } from './credit-service';
import { TokenService } from './token-service';
import { RateLimiter } from '../lib/rate-limiter';
import { CircuitBreaker } from '../lib/circuit-breaker';

export class ApiGatewayManager {
  constructor(
    private creditService: CreditService,
    private tokenService: TokenService,
    private rateLimiter: RateLimiter,
    private circuitBreaker: CircuitBreaker,
    private logger: Logger
  ) {}

  async processRequest(
    token: string,
    apiSlug: string,
    endpoint: string
  ): Promise<Response> {
    const log = this.logger.child({ operation: 'api_gateway_request' });

    // 1. Validate token
    const tokenData = await this.tokenService.validateToken(token);

    // 2. Check rate limits
    await this.rateLimiter.check(tokenData.userId, apiSlug);

    // 3. Deduct credits
    const creditCost = await this.getCreditCost(apiSlug, endpoint);
    await this.creditService.deductCredits(
      tokenData.userId,
      creditCost,
      `req_${Date.now()}`
    );

    // 4. Make upstream request with circuit breaker
    try {
      const response = await this.circuitBreaker.execute(
        () => this.callUpstream(apiSlug, endpoint)
      );

      return response;
    } catch (error) {
      // Refund on upstream failure
      log.warn({ err: error }, 'Upstream failed, refunding credits');
      await this.creditService.refundCredits(
        tokenData.userId,
        creditCost,
        `req_${Date.now()}`
      );
      throw error;
    }
  }

  private async getCreditCost(apiSlug: string, endpoint: string): Promise<number> {
    // Implementation
    return 10;
  }

  private async callUpstream(apiSlug: string, endpoint: string): Promise<Response> {
    // Implementation
    return new Response();
  }
}
```

### Builder Pattern

```typescript
// apps/api/src/services/query-builder.ts
import { Prisma } from '@prisma/client';

export class UsageQueryBuilder {
  private whereClause: Prisma.UsageLogWhereInput = {};
  private orderBy: Prisma.UsageLogOrderByWithRelationInput = { timestamp: 'desc' };
  private take = 100;
  private skip = 0;

  forUser(userId: bigint): this {
    this.whereClause.userId = userId;
    return this;
  }

  forApi(apiId: bigint): this {
    this.whereClause.apiId = apiId;
    return this;
  }

  dateRange(start: Date, end: Date): this {
    this.whereClause.timestamp = {
      gte: start,
      lte: end,
    };
    return this;
  }

  orderByTimestamp(direction: 'asc' | 'desc' = 'desc'): this {
    this.orderBy = { timestamp: direction };
    return this;
  }

  paginate(page: number, limit: number): this {
    this.take = limit;
    this.skip = (page - 1) * limit;
    return this;
  }

  build() {
    return {
      where: this.whereClause,
      orderBy: this.orderBy,
      take: this.take,
      skip: this.skip,
    };
  }
}

// Usage
const query = new UsageQueryBuilder()
  .forUser(userId)
  .dateRange(startDate, endDate)
  .orderByTimestamp('desc')
  .paginate(1, 50)
  .build();

const logs = await prisma.usageLog.findMany(query);
```

---

## Dependency Injection

### Constructor Injection (Recommended)

```typescript
// Service with dependencies
export class NotificationService {
  constructor(
    private prisma: PrismaClient,
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async notifyLowCredits(userId: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user) return;

    if (user.creditsRemaining < user.plan.monthlyCredits * 0.1) {
      await this.emailService.send({
        to: user.email,
        subject: 'Low Credit Balance',
        body: `You have ${user.creditsRemaining} credits remaining.`,
      });

      this.logger.info({ userId }, 'Low credit notification sent');
    }
  }
}

// Factory pattern for DI
export function createNotificationService(
  prisma: PrismaClient,
  emailService: EmailService,
  logger: Logger
): NotificationService {
  return new NotificationService(prisma, emailService, logger);
}
```

### Service Container Pattern

```typescript
// apps/api/src/services/container.ts
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { CreditService } from './credit-service';
import { TokenService } from './token-service';

export class ServiceContainer {
  public readonly creditService: CreditService;
  public readonly tokenService: TokenService;

  constructor(
    private prisma: PrismaClient,
    private app: FastifyInstance
  ) {
    this.creditService = new CreditService(prisma, app.log.child({ service: 'credit' }));
    this.tokenService = new TokenService(prisma, app.log.child({ service: 'token' }));
  }
}

// Fastify plugin for DI
export async function servicesPlugin(app: FastifyInstance) {
  const container = new ServiceContainer(app.prisma, app);

  app.decorate('services', container);
}

// Usage in routes
app.post('/deduct', async (request, reply) => {
  const result = await app.services.creditService.deductCredits(
    request.user.id,
    request.body.amount,
    request.body.idempotencyKey
  );

  return { success: result };
});
```

---

## Error Handling

### Service-Level Error Handling

```typescript
import { AppError, InsufficientCreditsError } from '../lib/errors';

export class CreditService {
  async deductCredits(userId: bigint, amount: number): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });

        if (!user) {
          throw new AppError('User not found', 404);
        }

        if (user.creditsRemaining < amount) {
          throw new InsufficientCreditsError(amount, user.creditsRemaining);
        }

        // ... deduction logic
      });

      return true;
    } catch (error) {
      // Log but re-throw for route handler
      this.logger.error({ err: error, userId, amount }, 'Credit deduction failed');
      throw error;
    }
  }
}
```

### Graceful Degradation

```typescript
export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      // Log but don't fail - degrade to no cache
      this.logger.warn({ err: error, key }, 'Cache read failed, degrading');
      return null;
    }
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      // Log but don't fail - service continues without cache
      this.logger.warn({ err: error, key }, 'Cache write failed, continuing');
    }
  }
}
```

---

## Testing Services

### Unit Testing Services

```typescript
// credit-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CreditService } from './credit-service';
import pino from 'pino';

// Mock Prisma
vi.mock('@prisma/client');

describe('CreditService', () => {
  let service: CreditService;
  let prisma: PrismaClient;
  let logger: pino.Logger;

  beforeEach(() => {
    prisma = new PrismaClient();
    logger = pino({ level: 'silent' });
    service = new CreditService(prisma, logger);
  });

  describe('deductCredits', () => {
    it('should deduct credits successfully', async () => {
      const userId = 1n;
      const amount = 100;

      // Mock user with sufficient credits
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        creditsRemaining: 1000,
      } as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(prisma);
      });

      const result = await service.deductCredits(userId, amount, 'test-key');

      expect(result).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error for insufficient credits', async () => {
      const userId = 1n;
      const amount = 1000;

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        creditsRemaining: 100,
      } as any);

      await expect(
        service.deductCredits(userId, amount, 'test-key')
      ).rejects.toThrow('Insufficient credits');
    });
  });
});
```

### Integration Testing

```typescript
// credit-service.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CreditService } from './credit-service';
import pino from 'pino';

const prisma = new PrismaClient();
const logger = pino();

describe('CreditService Integration', () => {
  let service: CreditService;
  let userId: bigint;

  beforeEach(async () => {
    service = new CreditService(prisma, logger);

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        planId: 1n,
        creditsRemaining: 1000,
        creditResetDay: 1,
      },
    });
    userId = user.id;
  });

  it('should deduct and record transaction', async () => {
    await service.deductCredits(userId, 100, 'integration-test');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.creditsRemaining).toBe(900);

    const tx = await prisma.creditTransaction.findFirst({
      where: { userId, idempotencyKey: 'integration-test' },
    });
    expect(tx).toBeDefined();
    expect(tx?.amount).toBe(-100);
  });
});
```

---

## Best Practices

### Do

- Keep services focused (Single Responsibility)
- Use dependency injection
- Return typed results
- Log important operations
- Handle errors appropriately
- Write tests for business logic
- Use transactions for multi-step operations
- Document complex logic

### Don't

- Mix HTTP concerns with business logic
- Access request/reply directly in services
- Create god services (too many responsibilities)
- Hardcode configuration
- Ignore error handling
- Skip logging
- Use services for simple CRUD
- Forget to test edge cases

---

## Related Documentation

- [DATABASE_PATTERNS.md](./DATABASE_PATTERNS.md)
- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md)
- [LOGGING_STANDARDS.md](./LOGGING_STANDARDS.md)
