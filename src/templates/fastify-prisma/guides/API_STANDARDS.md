# API Standards Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents RESTful API design patterns and standards for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [API Structure](#api-structure)
3. [Authentication](#authentication)
4. [Request Handling](#request-handling)
5. [Response Formats](#response-formats)
6. [Error Handling](#error-handling)
7. [Versioning](#versioning)
8. [Rate Limiting](#rate-limiting)
9. [Pagination](#pagination)
10. [Best Practices](#best-practices)

---

## Overview

The API Marketplace follows RESTful conventions with JSON responses, built on Fastify.

### Design Principles

- **Consistent**: Same patterns across all endpoints
- **Predictable**: Standard HTTP methods and status codes
- **Type-Safe**: Full TypeScript types with Zod validation
- **Secure**: Authentication required, proper authorization
- **Fast**: Optimized with Fastify performance
- **Documented**: Auto-generated from schemas

---

## API Structure

### Route Organization

```typescript
// apps/api/src/server.ts
import Fastify from 'fastify';

const app = Fastify();

// Health checks (no auth)
await app.register(healthRoutes);

// API v1 routes
await app.register(
  async (v1) => {
    // Public routes
    await v1.register(authModule, { prefix: '/auth' });

    // Authenticated routes
    v1.addHook('onRequest', authenticateUser);

    await v1.register(catalogModule, { prefix: '/catalog' });
    await v1.register(tokensModule, { prefix: '/tokens' });
    await v1.register(creditsModule, { prefix: '/credits' });
    await v1.register(usageModule, { prefix: '/usage' });
    await v1.register(orgsModule, { prefix: '/orgs' });
    await v1.register(gatewayModule, { prefix: '/gw' });
  },
  { prefix: '/v1' }
);
```

### URL Conventions

| Convention | Example |
|------------|---------|
| Plural nouns | `/v1/tokens` |
| Lowercase with hyphens | `/v1/api-catalog` |
| Nested resources | `/v1/users/:userId/tokens` |
| Actions as verbs | `/v1/tokens/:id/revoke` |

### HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Retrieve resource(s) | `GET /tokens` |
| POST | Create resource | `POST /tokens` |
| PUT | Full update | `PUT /tokens/123` |
| PATCH | Partial update | `PATCH /tokens/123` |
| DELETE | Delete resource | `DELETE /tokens/123` |

---

## Authentication

### JWT Authentication

```typescript
// apps/api/src/plugins/auth.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async function (app) {
  app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  // Decorator for authenticated user
  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});

// Usage in routes
app.get(
  '/profile',
  { onRequest: [app.authenticate] },
  async (request, reply) => {
    return request.user; // Automatically populated
  }
);
```

### API Key Authentication (Gateway)

```typescript
// apps/api/src/modules/gateway/index.ts
export async function gatewayModule(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    // Extract API key
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer mkp_live_')) {
      throw app.httpErrors.unauthorized('Invalid API key');
    }

    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);

    // Validate token
    const tokenData = await validateToken(tokenHash);
    if (!tokenData) {
      throw app.httpErrors.unauthorized('Invalid or expired token');
    }

    // Attach to request
    request.token = tokenData;
  });

  // Gateway routes...
}
```

### Authorization

```typescript
// Check permissions in route handler
app.delete(
  '/tokens/:id',
  { onRequest: [app.authenticate] },
  async (request, reply) => {
    const tokenId = BigInt(request.params.id);

    // Verify ownership
    const token = await prisma.token.findUnique({
      where: { id: tokenId },
    });

    if (!token || token.userId !== request.user.id) {
      throw app.httpErrors.forbidden('Not authorized');
    }

    await prisma.token.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    reply.code(204).send();
  }
);
```

---

## Request Handling

### Request Validation

```typescript
import { z } from 'zod';

// Create token endpoint
app.post(
  '/tokens',
  {
    onRequest: [app.authenticate],
    schema: {
      body: z.object({
        name: z.string().min(1).max(100),
        expiresAt: z.string().datetime().optional(),
        permissions: z.array(
          z.object({
            apiId: z.coerce.bigint(),
          })
        ).optional(),
      }),
    },
  },
  async (request, reply) => {
    const { name, expiresAt, permissions } = request.body;

    const token = await createToken({
      userId: request.user.id,
      name,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      permissions,
    });

    reply.code(201).send(token);
  }
);
```

### Query Parameters

```typescript
// List tokens with filters
app.get(
  '/tokens',
  {
    onRequest: [app.authenticate],
    schema: {
      querystring: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        status: z.enum(['active', 'revoked', 'expired']).optional(),
      }),
    },
  },
  async (request, reply) => {
    const { page, limit, status } = request.query;

    const tokens = await getTokens({
      userId: request.user.id,
      page,
      limit,
      status,
    });

    return {
      data: tokens,
      page,
      limit,
    };
  }
);
```

### Path Parameters

```typescript
// Get single token
app.get(
  '/tokens/:id',
  {
    onRequest: [app.authenticate],
    schema: {
      params: z.object({
        id: z.coerce.bigint(),
      }),
    },
  },
  async (request, reply) => {
    const { id } = request.params;

    const token = await prisma.token.findFirst({
      where: {
        id,
        userId: request.user.id,
      },
    });

    if (!token) {
      throw app.httpErrors.notFound('Token not found');
    }

    return token;
  }
);
```

---

## Response Formats

### Success Responses

```typescript
// Single resource (200 OK)
{
  "id": "123",
  "email": "user@example.com",
  "creditsRemaining": 1000,
  "createdAt": "2024-03-25T10:00:00Z"
}

// Collection (200 OK)
{
  "data": [
    { "id": "1", "name": "Token 1" },
    { "id": "2", "name": "Token 2" }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}

// Created (201 Created)
{
  "id": "123",
  "token": "mkp_live_abc123...",  // Only returned once
  "tokenPrefix": "mkp_live_abc",
  "createdAt": "2024-03-25T10:00:00Z"
}

// No content (204 No Content)
// Empty response body
```

### Response Schemas

```typescript
// Define response schemas for documentation
app.post(
  '/tokens',
  {
    schema: {
      body: createTokenSchema,
      response: {
        201: z.object({
          id: z.bigint(),
          token: z.string(),
          tokenPrefix: z.string(),
          name: z.string(),
          createdAt: z.date(),
        }),
        400: z.object({
          error: z.string(),
          code: z.string(),
        }),
      },
    },
  },
  async (request, reply) => {
    // Handler
  }
);
```

### Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Not authenticated |
| 402 | Payment Required | Insufficient credits |
| 403 | Forbidden | Not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Upstream error |
| 503 | Service Unavailable | Service down |

---

## Error Handling

### Error Response Format

```typescript
// Error response structure
interface ErrorResponse {
  error: string;          // Human-readable message
  code: string;           // Machine-readable code
  details?: unknown;      // Additional context
}
```

### Example Error Responses

```typescript
// 400 Bad Request
{
  "error": "Validation Error",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}

// 401 Unauthorized
{
  "error": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}

// 402 Payment Required
{
  "error": "Insufficient credits: need 100, have 50",
  "code": "INSUFFICIENT_CREDITS",
  "details": {
    "required": 100,
    "available": 50
  }
}

// 404 Not Found
{
  "error": "Token with id 123 not found",
  "code": "NOT_FOUND"
}

// 429 Rate Limit
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 60
  }
}
```

See [ERROR_HANDLING.md](./ERROR_HANDLING.md) for complete error handling guide.

---

## Versioning

### URL-Based Versioning (Current)

```typescript
// All routes under /v1
app.register(
  async (v1) => {
    // v1 routes
  },
  { prefix: '/v1' }
);

// Future version
app.register(
  async (v2) => {
    // v2 routes with breaking changes
  },
  { prefix: '/v2' }
);
```

### Version Strategy

- **Minor changes**: Same version (backward compatible)
- **Major changes**: New version (breaking changes)
- **Deprecation**: Support old version for 6-12 months
- **Documentation**: Clearly mark deprecated endpoints

---

## Rate Limiting

### Rate Limit Implementation

```typescript
import rateLimit from '@fastify/rate-limit';

// Global rate limiting
await app.register(rateLimit, {
  max: 100,           // Max requests
  timeWindow: '1 minute',
  redis: redisClient, // Use Redis for distributed rate limiting
});

// Per-route rate limiting
app.get(
  '/expensive-operation',
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  },
  async (request, reply) => {
    // Handler
  }
);
```

### Rate Limit Headers

```typescript
// Include rate limit info in response headers
reply.headers({
  'X-RateLimit-Limit': '100',
  'X-RateLimit-Remaining': '95',
  'X-RateLimit-Reset': '1640000000',
});
```

---

## Pagination

### Cursor-Based Pagination (Recommended)

```typescript
app.get(
  '/tokens',
  {
    schema: {
      querystring: z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
    },
  },
  async (request, reply) => {
    const { cursor, limit } = request.query;

    const tokens = await prisma.token.findMany({
      take: limit + 1, // Fetch one extra to check if there's more
      ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });

    const hasMore = tokens.length > limit;
    const items = hasMore ? tokens.slice(0, -1) : tokens;
    const nextCursor = hasMore ? items[items.length - 1].id.toString() : null;

    return {
      data: items,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }
);
```

### Offset-Based Pagination

```typescript
app.get(
  '/tokens',
  {
    schema: {
      querystring: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
    },
  },
  async (request, reply) => {
    const { page, limit } = request.query;
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.token.count(),
    ]);

    return {
      data: tokens,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
);
```

---

## Best Practices

### Do

- Use plural nouns for resources (`/tokens`, not `/token`)
- Use HTTP methods correctly (GET for read, POST for create)
- Return appropriate status codes
- Include request IDs for tracing
- Validate all input with Zod schemas
- Use TypeScript types throughout
- Implement rate limiting
- Log all API requests
- Document with OpenAPI/Swagger
- Version breaking changes
- Use pagination for collections
- Return created resource with 201
- Use 204 for successful deletes

### Don't

- Use verbs in URLs (`/getToken` ❌, use `GET /tokens/:id` ✅)
- Return 200 for everything
- Expose sensitive data in responses
- Skip input validation
- Use string for IDs (use BigInt)
- Ignore rate limiting
- Return stack traces in production
- Use GET for state-changing operations
- Skip authentication checks
- Hardcode URLs or secrets
- Return different formats for same endpoint

### API Design Checklist

```typescript
// ✅ Good API design
app.post(
  '/tokens',
  {
    onRequest: [app.authenticate],
    schema: {
      body: createTokenSchema,
      response: {
        201: tokenResponseSchema,
      },
    },
  },
  async (request, reply) => {
    const token = await createToken(request.body);
    reply.code(201).send(token);
  }
);

// ❌ Bad API design
app.get('/createToken', async (request, reply) => {
  const token = await createToken(request.query);
  return { success: true, data: token };
});
```

---

## OpenAPI Documentation

### Generate OpenAPI Spec

```bash
npm install @fastify/swagger @fastify/swagger-ui
```

```typescript
// apps/api/src/server.ts
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

await app.register(swagger, {
  openapi: {
    info: {
      title: 'API Marketplace API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development',
      },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
});
```

---

## Related Documentation

- [Fastify Documentation](https://fastify.dev)
- [VALIDATION_GUIDE.md](./VALIDATION_GUIDE.md)
- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [SECURITY.md](./SECURITY.md)
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md)
