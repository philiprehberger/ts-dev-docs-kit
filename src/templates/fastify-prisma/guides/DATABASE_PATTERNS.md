# Database Patterns Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents Prisma ORM patterns and database best practices for the API Marketplace application.

---

## Table of Contents

1. [Prisma Client Basics](#prisma-client-basics)
2. [Query Patterns](#query-patterns)
3. [Relationships](#relationships)
4. [Transactions](#transactions)
5. [Schema Best Practices](#schema-best-practices)
6. [Performance Optimization](#performance-optimization)
7. [Migrations](#migrations)

---

## Prisma Client Basics

### Accessing Prisma Client

```typescript
// Initialize once (in plugin or singleton)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

export default prisma;
```

### Basic CRUD Operations

```typescript
// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    planId: 1n,
    creditsRemaining: 1000,
    creditResetDay: 1,
  },
});

// Read one
const user = await prisma.user.findUnique({
  where: { id: 1n },
});

// Read many
const users = await prisma.user.findMany({
  where: {
    deletedAt: null,
    creditsRemaining: { gt: 0 },
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
});

// Update
const user = await prisma.user.update({
  where: { id: 1n },
  data: { creditsRemaining: 500 },
});

// Delete (hard)
await prisma.user.delete({
  where: { id: 1n },
});

// Delete (soft) - manual implementation
await prisma.user.update({
  where: { id: 1n },
  data: { deletedAt: new Date() },
});
```

---

## Query Patterns

### Filtering

```typescript
// Single condition
const activeUsers = await prisma.user.findMany({
  where: { deletedAt: null },
});

// Multiple conditions (AND)
const eligibleUsers = await prisma.user.findMany({
  where: {
    deletedAt: null,
    creditsRemaining: { gt: 0 },
    planId: { in: [1n, 2n, 3n] },
  },
});

// OR conditions
const users = await prisma.user.findMany({
  where: {
    OR: [
      { email: { contains: '@gmail.com' } },
      { email: { contains: '@yahoo.com' } },
    ],
  },
});

// NOT conditions
const users = await prisma.user.findMany({
  where: {
    NOT: { deletedAt: null },
  },
});

// Complex combinations
const apis = await prisma.api.findMany({
  where: {
    AND: [
      { status: 'ACTIVE' },
      {
        OR: [
          { creditCost: { lte: 100 } },
          { categoryId: 5n },
        ],
      },
    ],
  },
});
```

### Operators

```typescript
// Comparison operators
where: {
  creditsRemaining: {
    gt: 100,      // greater than
    gte: 100,     // greater than or equal
    lt: 1000,     // less than
    lte: 1000,    // less than or equal
    not: 0,       // not equal
  }
}

// String operators
where: {
  email: {
    equals: 'user@example.com',
    not: 'blocked@example.com',
    in: ['user1@example.com', 'user2@example.com'],
    notIn: ['spam@example.com'],
    contains: '@gmail.com',      // Case-sensitive
    startsWith: 'admin',
    endsWith: '@company.com',
  }
}

// Date operators
where: {
  createdAt: {
    gt: new Date('2024-01-01'),
    lt: new Date('2024-12-31'),
  }
}
```

### Selecting Fields

```typescript
// Select specific fields only
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    creditsRemaining: true,
  },
});
// Returns: { id, email, creditsRemaining }

// Select with relations
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    tokens: {
      select: {
        id: true,
        tokenPrefix: true,
      },
    },
  },
});
```

### Pagination

```typescript
// Offset pagination
const users = await prisma.user.findMany({
  skip: 20,    // Offset
  take: 10,    // Limit
  orderBy: { createdAt: 'desc' },
});

// Cursor-based pagination (better performance)
const users = await prisma.user.findMany({
  take: 10,
  skip: 1,  // Skip the cursor
  cursor: { id: lastUserId },
  orderBy: { id: 'asc' },
});

// Count for pagination
const [users, total] = await Promise.all([
  prisma.user.findMany({ skip: 0, take: 10 }),
  prisma.user.count(),
]);

const totalPages = Math.ceil(total / 10);
```

### Sorting

```typescript
// Single field
const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' },
});

// Multiple fields
const users = await prisma.user.findMany({
  orderBy: [
    { creditsRemaining: 'desc' },
    { createdAt: 'desc' },
  ],
});

// By relation
const apis = await prisma.api.findMany({
  orderBy: {
    category: {
      displayOrder: 'asc',
    },
  },
});
```

---

## Relationships

### Include Relations

```typescript
// Include single relation
const user = await prisma.user.findUnique({
  where: { id: 1n },
  include: {
    plan: true,
    tokens: true,
  },
});
// Returns user with plan and tokens

// Include nested relations
const user = await prisma.user.findUnique({
  where: { id: 1n },
  include: {
    tokens: {
      include: {
        permissions: {
          include: {
            api: true,
          },
        },
      },
    },
  },
});

// Include with filtering
const user = await prisma.user.findUnique({
  where: { id: 1n },
  include: {
    tokens: {
      where: {
        revokedAt: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    },
  },
});
```

### Relation Counts

```typescript
// Count relations
const users = await prisma.user.findMany({
  include: {
    _count: {
      select: {
        tokens: true,
        creditTransactions: true,
      },
    },
  },
});
// Access: user._count.tokens

// Count with filters
const users = await prisma.user.findMany({
  include: {
    _count: {
      select: {
        tokens: {
          where: { revokedAt: null },
        },
      },
    },
  },
});
```

### Creating with Relations

```typescript
// Create with nested creates
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    planId: 1n,
    creditsRemaining: 1000,
    creditResetDay: 1,
    tokens: {
      create: {
        name: 'Default Token',
        tokenHash: 'hash123',
        tokenPrefix: 'mkp_live_abc',
      },
    },
  },
  include: {
    tokens: true,
  },
});

// Connect existing relations
const token = await prisma.token.create({
  data: {
    name: 'API Token',
    tokenHash: 'hash456',
    tokenPrefix: 'mkp_live_def',
    user: {
      connect: { id: userId },
    },
  },
});
```

### Updating Relations

```typescript
// Update with nested updates
const user = await prisma.user.update({
  where: { id: 1n },
  data: {
    tokens: {
      update: {
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      },
    },
  },
});

// Disconnect relation
await prisma.token.update({
  where: { id: tokenId },
  data: {
    user: {
      disconnect: true,
    },
  },
});

// Delete nested
await prisma.user.update({
  where: { id: userId },
  data: {
    tokens: {
      delete: { id: tokenId },
    },
  },
});
```

---

## Transactions

### Basic Transactions

```typescript
// Automatic transaction (sequential)
const [user, credit] = await prisma.$transaction([
  prisma.user.create({ data: { ... } }),
  prisma.creditTransaction.create({ data: { ... } }),
]);

// Interactive transaction (with logic)
const result = await prisma.$transaction(async (tx) => {
  // Deduct credits
  const user = await tx.user.update({
    where: { id: userId },
    data: {
      creditsRemaining: {
        decrement: cost,
      },
    },
  });

  // Record transaction
  await tx.creditTransaction.create({
    data: {
      userId,
      amount: -cost,
      type: 'USAGE',
      idempotencyKey,
    },
  });

  return user;
});
```

### Atomic Credit Deduction

```typescript
// Safe credit deduction with validation
async function deductCredits(
  userId: bigint,
  cost: number,
  idempotencyKey: string,
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // Lock and check balance
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.creditsRemaining < cost) {
        throw new Error('Insufficient credits');
      }

      // Deduct
      await tx.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: {
            decrement: cost,
          },
        },
      });

      // Log
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -cost,
          type: 'USAGE',
          idempotencyKey,
        },
      });
    });

    return true;
  } catch (error) {
    return false;
  }
}
```

### Transaction Isolation

```typescript
// Set isolation level
await prisma.$transaction(
  async (tx) => {
    // Your queries
  },
  {
    isolationLevel: 'Serializable', // or ReadCommitted, RepeatableRead
    maxWait: 5000,  // Max time to wait for transaction
    timeout: 10000, // Max transaction time
  }
);
```

---

## Schema Best Practices

### Model Definition

```prisma
model User {
  id               BigInt    @id @default(autoincrement())
  email            String    @unique
  planId           BigInt    @map("plan_id")
  creditsRemaining Int       @default(0) @map("credits_remaining")
  creditResetDay   Int       @db.SmallInt @map("credit_reset_day")
  deletedAt        DateTime? @map("deleted_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  plan               Plan                @relation(fields: [planId], references: [id])
  tokens             Token[]
  creditTransactions CreditTransaction[]

  @@index([planId])
  @@index([deletedAt])
  @@index([email])
  @@map("users")
}
```

### Field Types

```prisma
// Common field types
model Example {
  // IDs
  id        BigInt  @id @default(autoincrement())
  uuid      String  @default(uuid())

  // Numbers
  count     Int
  bigCount  BigInt
  amount    Decimal @db.Decimal(10, 2)

  // Strings
  name      String
  email     String  @db.VarChar(255)
  text      String  @db.Text

  // Booleans
  isActive  Boolean @default(true)

  // Dates
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  // JSON
  metadata  Json    @db.JsonB

  // Enums
  status    Status  @default(ACTIVE)
}
```

### Indexes

```prisma
model UsageLog {
  id             BigInt   @id @default(autoincrement())
  userId         BigInt   @map("user_id")
  timestamp      DateTime @default(now())
  creditsUsed    Int      @map("credits_used")

  // Single column indexes
  @@index([userId])
  @@index([timestamp])

  // Composite indexes (order matters!)
  @@index([userId, timestamp])
  @@index([timestamp, userId])  // Different from above

  @@map("usage_logs")
}
```

### Constraints

```prisma
model Token {
  id        BigInt @id @default(autoincrement())
  tokenHash String @unique @map("token_hash")
  userId    BigInt @map("user_id")

  // Foreign key with actions
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("tokens")
}

// Composite unique constraint
model TokenPermission {
  id      BigInt @id @default(autoincrement())
  tokenId BigInt @map("token_id")
  apiId   BigInt @map("api_id")

  @@unique([tokenId, apiId])
  @@map("token_permissions")
}
```

---

## Performance Optimization

### Prevent N+1 Queries

```typescript
// Bad - N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  const tokens = await prisma.token.findMany({
    where: { userId: user.id },
  });
  // One query per user!
}

// Good - Single query with include
const users = await prisma.user.findMany({
  include: {
    tokens: true,
  },
});
```

### Select Only Needed Fields

```typescript
// Bad - Fetches all columns
const users = await prisma.user.findMany();

// Good - Only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    creditsRemaining: true,
  },
});
```

### Batch Operations

```typescript
// Create many (single query)
await prisma.user.createMany({
  data: [
    { email: 'user1@example.com', ... },
    { email: 'user2@example.com', ... },
  ],
  skipDuplicates: true,  // Ignore unique constraint errors
});

// Update many
await prisma.user.updateMany({
  where: { deletedAt: null },
  data: { creditsRemaining: 0 },
});

// Delete many
await prisma.user.deleteMany({
  where: {
    deletedAt: { not: null },
    createdAt: { lt: new Date('2023-01-01') },
  },
});
```

### Connection Pooling

```typescript
// Configure in PrismaClient
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10',
    },
  },
});

// Or in DATABASE_URL
// postgresql://user:pass@localhost:5432/db?connection_limit=10&pool_timeout=20
```

---

## Migrations

### Creating Migrations

```bash
# Create migration from schema changes
npx prisma migrate dev --name add_tokens_table

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

### Migration Best Practices

```prisma
// 1. Add nullable columns first
model User {
  email    String
  newField String?  // Add as nullable
}

// 2. Then make required in next migration (with default or data migration)
model User {
  email    String
  newField String @default("default")
}
```

### Data Migrations

```typescript
// In a separate script (not in schema.prisma)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
  // Update existing records
  await prisma.user.updateMany({
    where: { creditsRemaining: null },
    data: { creditsRemaining: 0 },
  });
}

migrate().finally(() => prisma.$disconnect());
```

---

## Best Practices Summary

### Do

- Use transactions for multi-step operations
- Select only needed fields
- Use includes/select to prevent N+1 queries
- Add indexes for frequently queried columns
- Use enums for status fields
- Use soft deletes for recoverable data
- Use `BigInt` for IDs in high-volume tables
- Use connection pooling in production

### Avoid

- N+1 queries (use `include`)
- Selecting all columns when few are needed
- Missing indexes on foreign keys
- Hard deletes for important data
- Nested transactions (not supported)
- Very long transactions (risk of deadlocks)

---

## Related Documentation

- [Prisma Documentation](https://www.prisma.io/docs)
- [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md)
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md)
- [API_STANDARDS.md](./API_STANDARDS.md)
