# Security Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents security best practices for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Authorization](#authorization)
4. [Input Validation](#input-validation)
5. [SQL Injection Prevention](#sql-injection-prevention)
6. [Rate Limiting](#rate-limiting)
7. [API Key Security](#api-key-security)
8. [CORS Configuration](#cors-configuration)
9. [Security Headers](#security-headers)
10. [Sensitive Data](#sensitive-data)
11. [Environment Management](#environment-management)
12. [Security Checklist](#security-checklist)

---

## Overview

Security is implemented at multiple layers:

| Layer | Protection |
|-------|------------|
| Authentication | JWT tokens, API keys |
| Authorization | Role-based access control |
| Input | Zod validation, type checking |
| Output | Proper status codes, no stack traces |
| Database | Prisma ORM, parameterized queries |
| Transport | HTTPS, secure cookies |
| Rate Limiting | Redis-based throttling |

---

## Authentication

### JWT Configuration

```typescript
// apps/api/src/plugins/auth.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async function (app) {
  app.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: '24h',      // Token expiration
      algorithm: 'HS256',    // HMAC SHA256
    },
  });
});
```

### Password Hashing

```typescript
import bcrypt from 'bcrypt';

// Hash password before storing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // High cost factor
  return bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Usage in registration
const passwordHash = await hashPassword(request.body.password);
await prisma.user.create({
  data: {
    email: request.body.email,
    passwordHash,
  },
});
```

### Password Requirements

```typescript
import { z } from 'zod';

// Strong password validation
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine(
    async (password) => {
      // Check against common passwords list
      return !COMMON_PASSWORDS.includes(password.toLowerCase());
    },
    'Password is too common'
  );
```

### Login Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

// Stricter rate limiting for login
app.post(
  '/v1/auth/login',
  {
    config: {
      rateLimit: {
        max: 5,                    // 5 attempts
        timeWindow: '15 minutes',  // per 15 minutes
        redis: redisClient,
      },
    },
  },
  async (request, reply) => {
    // Login logic
  }
);
```

---

## Authorization

### Role-Based Access Control (RBAC)

```typescript
// Check user role
export function requireRole(...roles: OrgRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      throw request.server.httpErrors.unauthorized();
    }

    const membership = await request.server.prisma.orgMembership.findFirst({
      where: {
        userId: request.user.id,
        organizationId: request.user.currentOrgId,
      },
    });

    if (!membership || !roles.includes(membership.role)) {
      throw request.server.httpErrors.forbidden('Insufficient permissions');
    }
  };
}

// Usage
app.delete(
  '/orgs/:id/members/:userId',
  {
    onRequest: [
      authenticateUser,
      requireRole('OWNER', 'ADMIN'),
    ],
  },
  async (request, reply) => {
    // Only owners and admins can remove members
  }
);
```

### Resource Ownership Check

```typescript
// Verify user owns resource
app.delete('/tokens/:id', async (request, reply) => {
  const tokenId = BigInt(request.params.id);

  const token = await prisma.token.findUnique({
    where: { id: tokenId },
  });

  // Check ownership
  if (!token || token.userId !== request.user.id) {
    throw app.httpErrors.forbidden('Not authorized to delete this token');
  }

  await prisma.token.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  reply.code(204).send();
});
```

---

## Input Validation

### Always Validate Input

```typescript
import { z } from 'zod';

// Never trust client input
app.post(
  '/users',
  {
    schema: {
      body: z.object({
        email: z.string().email().toLowerCase(),
        planId: z.coerce.bigint().positive(),
        creditsRemaining: z.number().int().min(0).max(1000000),
      }),
    },
  },
  async (request, reply) => {
    // request.body is validated and typed
    const user = await createUser(request.body);
    return user;
  }
);
```

### Sanitize User Input

```typescript
// Remove potentially dangerous characters
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .substring(0, 1000);  // Limit length
}

// Validate file uploads
const fileSchema = z.object({
  filename: z.string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename')
    .refine(
      (name) => !name.includes('..'),
      'Path traversal not allowed'
    ),
  mimetype: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
});
```

---

## SQL Injection Prevention

### Use Prisma Parameterized Queries

```typescript
// ✅ Good - Prisma automatically parameterizes
const user = await prisma.user.findUnique({
  where: { email: userInput },
});

// ✅ Good - Raw query with parameters
const users = await prisma.$queryRaw`
  SELECT * FROM users
  WHERE email = ${userInput}
`;

// ❌ Bad - String interpolation (vulnerable)
const users = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${userInput}'`
);
```

### Never Build SQL from String Concatenation

```typescript
// ❌ NEVER DO THIS
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Always use Prisma or parameterized queries
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

---

## Rate Limiting

### Global Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

await app.register(rateLimit, {
  max: 100,                  // Requests per window
  timeWindow: '15 minutes',  // Time window
  redis: redisClient,        // Use Redis for distributed
  keyGenerator: (request) => {
    // Rate limit by user or IP
    return request.user?.id.toString() || request.ip;
  },
  errorResponseBuilder: (request, context) => {
    return {
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      details: {
        retryAfter: context.after,
      },
    };
  },
});
```

### Per-Route Rate Limiting

```typescript
// Stricter limits for expensive operations
app.post(
  '/gw/:apiSlug/*',
  {
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 hour',
      },
    },
  },
  gatewayHandler
);

// Very strict for authentication
app.post(
  '/auth/login',
  {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  },
  loginHandler
);
```

---

## API Key Security

### Token Generation

```typescript
import crypto from 'crypto';

// Generate cryptographically secure token
export function generateToken(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `mkp_live_${random}`;
}

// Hash token for storage
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}
```

### Token Storage

```typescript
// ✅ Good - Store hash, not plaintext
const rawToken = generateToken();
const tokenHash = hashToken(rawToken);

await prisma.token.create({
  data: {
    userId,
    name: 'API Token',
    tokenHash,                         // Store hash
    tokenPrefix: rawToken.substring(0, 16), // For display
  },
});

// Return raw token ONLY once
return {
  token: rawToken,  // User must save this
  tokenPrefix: rawToken.substring(0, 16),
};

// ❌ Bad - Never store plaintext
await prisma.token.create({
  data: {
    token: rawToken,  // NEVER store plaintext!
  },
});
```

### Token Validation

```typescript
export async function validateToken(token: string): Promise<TokenData | null> {
  const tokenHash = hashToken(token);

  // Check Redis cache first
  const cached = await redis.get(`token:${tokenHash}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fallback to database
  const tokenData = await prisma.token.findUnique({
    where: { tokenHash },
    include: {
      user: true,
      permissions: true,
    },
  });

  // Validate token
  if (!tokenData) return null;
  if (tokenData.revokedAt) return null;
  if (tokenData.deletedAt) return null;
  if (tokenData.expiresAt && tokenData.expiresAt < new Date()) return null;

  // Cache valid token
  await redis.setex(
    `token:${tokenHash}`,
    60, // 60 seconds
    JSON.stringify(tokenData)
  );

  return tokenData;
}
```

### Token Prefix for Leak Detection

```typescript
// Use recognizable prefix for GitHub secret scanning
const TOKEN_PREFIX = 'mkp_live_'; // Detectable by secret scanners

// GitHub will detect and alert on leaked tokens with this prefix
export function generateToken(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `${TOKEN_PREFIX}${random}`;
}
```

---

## CORS Configuration

### Configure CORS Properly

```typescript
import cors from '@fastify/cors';

await app.register(cors, {
  origin: (origin, callback) => {
    // Allow requests from configured origins
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  maxAge: 600, // 10 minutes
});

// ❌ Bad - Allow all origins (development only!)
await app.register(cors, {
  origin: true, // NEVER in production
});
```

---

## Security Headers

### Add Security Headers

```typescript
import helmet from '@fastify/helmet';

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  xssFilter: true,
});

// Or add manually
app.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});
```

---

## Sensitive Data

### Never Log Sensitive Data

```typescript
// ❌ Bad - Logging sensitive data
app.log.info({ password: user.password }, 'User created');
app.log.info({ token: apiKey }, 'Token generated');
app.log.info({ creditCard: payment.cardNumber }, 'Payment processed');

// ✅ Good - Log only non-sensitive data
app.log.info({ userId: user.id }, 'User created');
app.log.info({ tokenPrefix: apiKey.substring(0, 16) }, 'Token generated');
app.log.info({ paymentId: payment.id }, 'Payment processed');
```

### Redact Sensitive Fields

```typescript
// Custom serializer for sensitive data
function redactSensitive(obj: any): any {
  const sensitive = ['password', 'token', 'apiKey', 'secret', 'creditCard'];
  const redacted = { ...obj };

  for (const key of Object.keys(redacted)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }

  return redacted;
}

// Usage
app.log.info(redactSensitive(user), 'User data');
```

---

## Environment Management

### Secure Environment Variables

```bash
# .env - NEVER commit to git!
DATABASE_URL="postgresql://..."
JWT_SECRET="<generate-64-char-random-string>"
REDIS_URL="redis://..."

# Add .env to .gitignore
echo ".env" >> .gitignore
```

### Generate Strong Secrets

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use openssl
openssl rand -hex 64
```

### Environment Validation

```typescript
import { z } from 'zod';

// Validate environment variables on startup
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string(),
});

const env = envSchema.parse(process.env);
export default env;
```

---

## Security Checklist

### Application Security

- [ ] Use HTTPS in production (TLS 1.2+)
- [ ] Strong JWT secrets (64+ characters)
- [ ] Password hashing with bcrypt (cost factor 12+)
- [ ] Rate limiting on all endpoints
- [ ] Input validation with Zod
- [ ] SQL injection prevention (use Prisma)
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Error messages don't expose internals
- [ ] No sensitive data in logs
- [ ] API keys hashed in database
- [ ] Token expiration implemented
- [ ] Token revocation supported

### Authentication & Authorization

- [ ] JWT with expiration
- [ ] Secure password requirements
- [ ] Login rate limiting (5 attempts/15min)
- [ ] Role-based access control
- [ ] Resource ownership checks
- [ ] API key authentication for gateway
- [ ] Token prefix for leak detection

### Data Protection

- [ ] Passwords hashed, never plaintext
- [ ] API keys hashed in database
- [ ] Sensitive data not logged
- [ ] Database connections encrypted
- [ ] Backups encrypted
- [ ] PII handling compliant

### Infrastructure

- [ ] Environment variables validated
- [ ] Secrets not in code/git
- [ ] Dependencies up to date
- [ ] Security patches applied
- [ ] Firewall configured
- [ ] Database access restricted
- [ ] Redis protected with password
- [ ] Monitoring and alerting enabled

---

## Related Documentation

- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [VALIDATION_GUIDE.md](./VALIDATION_GUIDE.md)
- [API_STANDARDS.md](./API_STANDARDS.md)
- [LOGGING_STANDARDS.md](./LOGGING_STANDARDS.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
