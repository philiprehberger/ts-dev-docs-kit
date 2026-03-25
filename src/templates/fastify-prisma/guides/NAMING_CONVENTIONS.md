# Naming Conventions Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents the naming conventions used throughout the API Marketplace codebase to ensure consistency and maintainability.

---

## Table of Contents

1. [TypeScript/JavaScript](#typescriptjavascript)
2. [Files and Directories](#files-and-directories)
3. [Database (Prisma)](#database-prisma)
4. [React/Next.js](#reactnextjs)
5. [Routes](#routes)
6. [Configuration](#configuration)
7. [Tests](#tests)

---

## TypeScript/JavaScript

### Classes, Interfaces, and Types

| Pattern | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `TokenService`, `CreditManager` |
| Interfaces | PascalCase with `I` prefix optional | `User`, `IUserService` |
| Type aliases | PascalCase | `ApiEndpoint`, `CreditTransaction` |
| Enums | PascalCase | `ApiStatus`, `OrgRole` |
| Enum values | SCREAMING_SNAKE_CASE | `ACTIVE`, `MONTHLY_GRANT` |

```typescript
// Good
class TokenService {
  generateToken(): string {}
}

interface User {
  id: bigint;
  email: string;
}

type ApiEndpoint = {
  method: string;
  path: string;
  creditCost: number;
};

enum ApiStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DISABLED = 'disabled',
}

// Bad
class tokenService {}  // Wrong case
interface user {}      // Wrong case
type api_endpoint {}   // Wrong case
```

### Functions and Methods

| Pattern | Convention | Example |
|---------|------------|---------|
| Regular functions | camelCase | `getActiveUsers()`, `calculateTotal()` |
| Boolean functions | is/has/can/should prefix | `isActive()`, `hasPermission()` |
| Async functions | Prefix with async or return Promise | `async getUser()`, `fetchData()` |
| Event handlers | handle/on prefix | `handleClick()`, `onSubmit()` |

```typescript
// Good
function getActiveClients(): Client[] {}
function isOverdue(invoice: Invoice): boolean {}
async function fetchApiCatalog(): Promise<Api[]> {}
function handleTokenRevoke(tokenId: string): void {}

// Bad
function GetActiveClients() {}  // Wrong case
function active(): boolean {}   // Missing 'is' prefix
function get_clients() {}       // Use camelCase
```

### Variables and Constants

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `userName`, `totalAmount` |
| Boolean variables | is/has/can prefix | `isActive`, `hasErrors` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE`, `DEFAULT_TIMEOUT` |
| Private properties | Prefix with `_` or `#` | `_privateField`, `#count` |
| Collections | Plural | `users`, `apiEndpoints` |

```typescript
// Good
const userName = 'John';
const isActive = true;
const MAX_RETRIES = 3;
const users = await prisma.user.findMany();

// Bad
const UserName = 'John';    // Wrong case
const active = true;        // Add 'is' prefix
const max_retries = 3;      // Wrong case for constant
const user_list = [];       // Use camelCase
```

### Generics

```typescript
// Good
function findById<T>(id: string): T | null {}
class Repository<TEntity> {}
type ApiResponse<TData> = {
  data: TData;
  status: number;
};

// Descriptive generics for complex types
type PaginatedResponse<TItem> = {
  items: TItem[];
  total: number;
  page: number;
};
```

---

## Files and Directories

### TypeScript/JavaScript Files

| Type | Convention | Example |
|------|------------|---------|
| Modules | kebab-case.ts | `user-service.ts`, `credit-manager.ts` |
| Types | kebab-case.ts | `api-types.ts`, `user-types.ts` |
| Tests | kebab-case.test.ts | `user-service.test.ts` |
| Config | kebab-case.ts | `database.config.ts` |

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   └── index.ts
│   ├── tokens/
│   │   └── index.ts
│   └── gateway/
│       └── index.ts
├── lib/
│   ├── token.ts
│   ├── rate-limiter.ts
│   └── circuit-breaker.ts
└── jobs/
    ├── usage-logger.ts
    └── refund-retry.ts
```

### React/Next.js Files

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `UserCard.tsx`, `ApiCatalog.tsx` |
| Pages (App Router) | kebab-case/page.tsx | `app/dashboard/page.tsx` |
| Layouts | layout.tsx | `app/layout.tsx` |
| Hooks | use-kebab-case.ts | `use-auth.ts`, `use-credits.ts` |
| Utils | kebab-case.ts | `format-date.ts`, `api-client.ts` |

```
apps/web/
├── app/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── api-catalog/
│   │   └── page.tsx
│   └── layout.tsx
├── components/
│   ├── UserCard.tsx
│   ├── ApiCatalog.tsx
│   └── CreditBalance.tsx
└── lib/
    ├── use-auth.ts
    └── api-client.ts
```

---

## Database (Prisma)

### Schema Naming

| Pattern | Convention | Example |
|---------|------------|---------|
| Models | PascalCase singular | `User`, `ApiEndpoint` |
| Table names | snake_case plural | `users`, `api_endpoints` |
| Columns | snake_case | `user_id`, `created_at` |
| Enums | PascalCase | `ApiStatus`, `OrgRole` |
| Enum values | SCREAMING_SNAKE_CASE | `ACTIVE`, `MEMBER` |
| Relations | camelCase plural/singular | `user`, `tokens`, `creditTransactions` |

```prisma
// Good
model User {
  id               BigInt   @id @default(autoincrement())
  email            String   @unique
  creditsRemaining Int      @map("credits_remaining")
  createdAt        DateTime @default(now()) @map("created_at")

  tokens             Token[]
  creditTransactions CreditTransaction[]

  @@map("users")
}

model Token {
  id        BigInt @id @default(autoincrement())
  userId    BigInt @map("user_id")
  tokenHash String @unique @map("token_hash")

  user User @relation(fields: [userId], references: [id])

  @@map("tokens")
}

enum ApiStatus {
  ACTIVE      @map("active")
  DEPRECATED  @map("deprecated")

  @@map("api_status")
}
```

### Indexes

```prisma
model UsageLog {
  id        BigInt @id
  userId    BigInt @map("user_id")
  timestamp DateTime

  @@index([userId])
  @@index([userId, timestamp])
  @@map("usage_logs")
}
```

---

## React/Next.js

### Component Naming

```typescript
// Good - Component file: UserCard.tsx
export function UserCard({ user }: { user: User }) {
  return <div>{user.name}</div>;
}

// Component with props interface
interface ApiCardProps {
  api: Api;
  onClick?: () => void;
}

export function ApiCard({ api, onClick }: ApiCardProps) {
  return <div onClick={onClick}>{api.name}</div>;
}

// Bad
export function userCard() {}  // Wrong case
export function User_Card() {} // Wrong separator
```

### Hooks

```typescript
// Good - Custom hook
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  return { user, setUser };
}

export function useApiCatalog(filters: ApiFilters) {
  const { data, isLoading } = useSWR('/api/catalog', fetcher);
  return { apis: data, isLoading };
}

// Bad
export function AuthHook() {}  // Should start with 'use'
export function Use_Auth() {}  // Wrong case
```

### Props

```typescript
// Good
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}

export function Button({ children, onClick, variant = 'primary', isLoading }: ButtonProps) {}

// Bad
interface button_props {}    // Wrong case
interface IButtonProps {}    // Don't use 'I' prefix in React
```

---

## Routes

### API Routes (Fastify)

| Pattern | Convention | Example |
|---------|------------|---------|
| Path segments | kebab-case | `/api-catalog`, `/credit-history` |
| Parameters | camelCase | `/:userId`, `/:apiSlug` |
| Query params | snake_case | `?api_status=active` |

```typescript
// Good
app.get('/v1/api-catalog', handler);
app.get('/v1/users/:userId/tokens', handler);
app.post('/v1/gw/:apiSlug/endpoint', handler);
app.get('/v1/usage', handler); // ?start_date=2024-01-01

// Bad
app.get('/v1/apiCatalog', handler);     // Use kebab-case
app.get('/v1/users/:user_id', handler); // Use camelCase for params
```

### Next.js Routes

```typescript
// File structure determines routes
app/
  dashboard/
    page.tsx          → /dashboard
  api-catalog/
    page.tsx          → /api-catalog
  tokens/
    [id]/
      page.tsx        → /tokens/:id
```

---

## Configuration

### Environment Variables

| Pattern | Convention | Example |
|---------|------------|---------|
| All variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET` |
| Prefixes | Namespace with prefix | `NEXT_PUBLIC_`, `GOOGLE_`, `AWS_` |

```bash
# Good
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=secret123
GOOGLE_CLIENT_ID=abc123
NEXT_PUBLIC_API_URL=http://localhost:4000

# Bad
databaseUrl=...     # Wrong case
Database_Url=...    # Wrong case
db_url=...         # Too abbreviated
```

### Config Objects

```typescript
// Good
export const config = {
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: 10,
  },
  redis: {
    url: process.env.REDIS_URL,
    ttl: 60,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
  },
};

// Access
const dbUrl = config.database.url;
```

---

## Tests

### Test Files

| Type | Convention | Example |
|------|------------|---------|
| Unit tests | *.test.ts | `token.test.ts` |
| Integration tests | *.test.ts | `gateway.test.ts` |
| E2E tests | *.e2e.test.ts | `auth.e2e.test.ts` |

### Test Names

```typescript
// Good - Descriptive test names
describe('TokenService', () => {
  it('should generate valid token with correct prefix', () => {});
  it('should throw error when token is expired', () => {});
  it('should revoke token immediately', () => {});
});

describe('Credit System', () => {
  it('should deduct credits atomically', () => {});
  it('should refund credits on upstream failure', () => {});
});

// Bad
describe('TokenService', () => {
  it('test1', () => {});  // Not descriptive
  it('works', () => {});  // Too vague
});
```

---

## Quick Reference

### Naming Patterns Summary

| Context | Convention | Example |
|---------|------------|---------|
| Classes/Types | PascalCase | `TokenService` |
| Functions/Methods | camelCase | `getUser()` |
| Variables | camelCase | `userName` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_SIZE` |
| Files | kebab-case | `user-service.ts` |
| Components | PascalCase | `UserCard.tsx` |
| Database tables | snake_case plural | `users` |
| Database columns | snake_case | `created_at` |
| Routes | kebab-case | `/api-catalog` |
| Env variables | SCREAMING_SNAKE_CASE | `DATABASE_URL` |

### Do's

- Use consistent casing within each context
- Use descriptive names that explain intent
- Prefix booleans with is/has/can/should
- Use plural for collections
- Keep names concise but clear

### Don'ts

- Avoid abbreviations unless universally understood
- Don't mix naming conventions
- Don't use single-letter names (except loop counters)
- Don't use Hungarian notation
- Don't use noise words (data, info, manager unnecessarily)

---

## Related Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Prisma Naming Conventions](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#naming-conventions)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [DATABASE_PATTERNS.md](./DATABASE_PATTERNS.md)
