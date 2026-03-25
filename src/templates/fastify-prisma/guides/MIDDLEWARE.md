# Middleware Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents Fastify hooks and middleware patterns for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [Fastify Hooks](#fastify-hooks)
3. [Creating Plugins](#creating-plugins)
4. [Common Patterns](#common-patterns)
5. [Authentication & Authorization](#authentication--authorization)
6. [Request Processing](#request-processing)
7. [Response Modification](#response-modification)
8. [Testing](#testing)

---

## Overview

Fastify uses **hooks** and **plugins** instead of traditional middleware. Hooks allow you to intercept the request/response lifecycle at specific points.

### Request Lifecycle

```
Request
  ↓
onRequest hook
  ↓
preParsing hook
  ↓
preValidation hook (validation happens)
  ↓
preHandler hook
  ↓
Handler (route handler)
  ↓
preSerialization hook
  ↓
onSend hook
  ↓
Response
  ↓
onResponse hook
```

---

## Fastify Hooks

### Hook Types

| Hook | When | Use Case |
|------|------|----------|
| `onRequest` | Before parsing | Authentication, logging |
| `preParsing` | Before body parsing | Stream manipulation |
| `preValidation` | Before validation | Additional checks |
| `preHandler` | Before handler | Authorization, rate limiting |
| `preSerialization` | Before serialization | Transform response |
| `onSend` | Before sending | Compression, headers |
| `onResponse` | After response sent | Logging, metrics |
| `onError` | On error | Custom error handling |

### Adding Hooks

```typescript
// Global hook (all routes)
app.addHook('onRequest', async (request, reply) => {
  request.log.info({ url: request.url }, 'Request started');
});

// Route-specific hook
app.get(
  '/protected',
  {
    onRequest: [authenticateUser, checkPermissions],
  },
  async (request, reply) => {
    return { message: 'Protected resource' };
  }
);

// Plugin-scoped hook
export async function myModule(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    // Only applies to routes in this module
  });

  app.get('/route', handler);
}
```

---

## Creating Plugins

### Basic Plugin

```typescript
// apps/api/src/plugins/auth.ts
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

export default fp(async function authPlugin(app: FastifyInstance) {
  // Decorate request with user
  app.decorateRequest('user', null);

  // Authentication hook
  app.decorate('authenticate', async function (request, reply) {
    try {
      // Verify JWT
      const payload = await request.jwtVerify();

      // Load user
      const user = await app.prisma.user.findUnique({
        where: { id: BigInt(payload.sub) },
      });

      if (!user || user.deletedAt) {
        throw app.httpErrors.unauthorized('User not found');
      }

      request.user = user;
    } catch (error) {
      throw app.httpErrors.unauthorized('Invalid token');
    }
  });
});

// Register in server.ts
await app.register(authPlugin);
```

### Plugin with Options

```typescript
// apps/api/src/plugins/rate-limiter.ts
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

interface RateLimiterOptions {
  max: number;
  timeWindow: string;
}

export default fp<RateLimiterOptions>(
  async function rateLimiterPlugin(app, opts) {
    const { max, timeWindow } = opts;

    app.addHook('onRequest', async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) return;

      const key = `rate-limit:${userId}`;
      const count = await app.redis.incr(key);

      if (count === 1) {
        await app.redis.expire(key, parseTimeWindow(timeWindow));
      }

      if (count > max) {
        throw app.httpErrors.tooManyRequests('Rate limit exceeded');
      }

      reply.header('X-RateLimit-Limit', max);
      reply.header('X-RateLimit-Remaining', Math.max(0, max - count));
    });
  }
);

// Register with options
await app.register(rateLimiterPlugin, {
  max: 100,
  timeWindow: '1m',
});
```

---

## Common Patterns

### Authentication Hook

```typescript
// apps/api/src/hooks/authenticate.ts
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw request.server.httpErrors.unauthorized('Missing or invalid token');
  }

  const token = authHeader.substring(7);

  try {
    const payload = await request.server.jwt.verify(token);

    const user = await request.server.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      include: { plan: true },
    });

    if (!user || user.deletedAt) {
      throw request.server.httpErrors.unauthorized('User not found');
    }

    request.user = user;
  } catch (error) {
    throw request.server.httpErrors.unauthorized('Invalid token');
  }
}

// Usage
app.get(
  '/profile',
  { onRequest: [authenticateUser] },
  async (request, reply) => {
    return request.user;
  }
);
```

### Authorization Hook

```typescript
// apps/api/src/hooks/authorize.ts
import type { FastifyRequest, FastifyReply } from 'fastify';

export function requireRole(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      throw request.server.httpErrors.unauthorized('Not authenticated');
    }

    // Check user role (if using organizations)
    const membership = await request.server.prisma.orgMembership.findFirst({
      where: {
        userId: request.user.id,
        organizationId: request.user.currentOrgId,
      },
    });

    if (!membership || !allowedRoles.includes(membership.role)) {
      throw request.server.httpErrors.forbidden('Insufficient permissions');
    }
  };
}

// Usage
app.delete(
  '/users/:id',
  {
    onRequest: [
      authenticateUser,
      requireRole('OWNER', 'ADMIN'),
    ],
  },
  async (request, reply) => {
    // Only owners and admins can delete users
  }
);
```

### Request Logging Hook

```typescript
// apps/api/src/hooks/request-logger.ts
export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const start = Date.now();

  request.log.info(
    {
      method: request.method,
      url: request.url,
      userId: request.user?.id,
      requestId: request.id,
    },
    'Request started'
  );

  reply.addHook('onSend', async (request, reply) => {
    const duration = Date.now() - start;

    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        userId: request.user?.id,
        requestId: request.id,
      },
      'Request completed'
    );
  });
}

// Register globally
app.addHook('onRequest', requestLogger);
```

### Request ID Hook

```typescript
// Automatically handled by Fastify with requestIdHeader
const app = Fastify({
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID(),
});

// Access in hooks/handlers
app.addHook('onRequest', async (request, reply) => {
  request.log.info({ requestId: request.id }, 'Processing request');
});
```

---

## Authentication & Authorization

### Multi-Strategy Authentication

```typescript
// Support both JWT and API keys
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw request.server.httpErrors.unauthorized('Missing authorization');
  }

  // JWT authentication
  if (authHeader.startsWith('Bearer eyJ')) {
    const token = authHeader.substring(7);
    const payload = await request.server.jwt.verify(token);
    request.user = await loadUser(payload.sub);
    return;
  }

  // API key authentication
  if (authHeader.startsWith('Bearer mkp_live_')) {
    const apiKey = authHeader.substring(7);
    const tokenData = await validateApiKey(apiKey);
    request.user = tokenData.user;
    request.token = tokenData.token;
    return;
  }

  throw request.server.httpErrors.unauthorized('Invalid authorization format');
}
```

### Conditional Authentication

```typescript
// Optional authentication (public + private data)
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = await request.server.jwt.verify(token);
      request.user = await loadUser(payload.sub);
    } catch (error) {
      // Ignore auth errors, continue as guest
      request.log.debug('Optional auth failed, continuing as guest');
    }
  }
}

// Usage - show more data to authenticated users
app.get(
  '/api-catalog',
  { onRequest: [optionalAuth] },
  async (request, reply) => {
    const apis = await getApis({
      includePrivate: !!request.user,
      userId: request.user?.id,
    });

    return { apis };
  }
);
```

---

## Request Processing

### Body Parsing Hook

```typescript
// Custom body parsing
app.addHook('preParsing', async (request, reply, payload) => {
  // Limit body size
  const MAX_SIZE = 1024 * 1024; // 1MB

  let size = 0;
  payload.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_SIZE) {
      throw request.server.httpErrors.payloadTooLarge('Request too large');
    }
  });

  return payload;
});
```

### Content Type Validation

```typescript
app.addHook('preValidation', async (request, reply) => {
  if (request.method === 'POST' || request.method === 'PUT') {
    const contentType = request.headers['content-type'];

    if (!contentType?.includes('application/json')) {
      throw request.server.httpErrors.unsupportedMediaType(
        'Content-Type must be application/json'
      );
    }
  }
});
```

### Query Parameter Transformation

```typescript
app.addHook('preValidation', async (request, reply) => {
  // Convert string IDs to BigInt
  if (request.params.id) {
    try {
      request.params.id = BigInt(request.params.id);
    } catch (error) {
      throw request.server.httpErrors.badRequest('Invalid ID format');
    }
  }
});
```

---

## Response Modification

### Add Headers Hook

```typescript
app.addHook('onSend', async (request, reply, payload) => {
  // Add security headers
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');

  // Add custom headers
  reply.header('X-Request-ID', request.id);
  reply.header('X-Response-Time', Date.now() - request.startTime);

  return payload;
});
```

### Response Transformation

```typescript
app.addHook('preSerialization', async (request, reply, payload) => {
  // Wrap all responses in envelope
  if (reply.statusCode < 400) {
    return {
      success: true,
      data: payload,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return payload;
});
```

### CORS Headers

```typescript
import cors from '@fastify/cors';

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
});
```

---

## Testing

### Testing Hooks

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { authenticateUser } from './authenticate';

describe('authenticateUser hook', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(authPlugin);

    app.get(
      '/protected',
      { onRequest: [authenticateUser] },
      async () => ({ message: 'success' })
    );
  });

  it('should allow valid token', async () => {
    const token = generateValidToken();

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer invalid',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject missing token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
  });
});
```

---

## Best Practices

### Do

- Use plugins for reusable logic
- Use hooks for request/response processing
- Keep hooks focused and simple
- Use decorators for shared state
- Log important hook operations
- Handle errors appropriately
- Test hooks independently
- Use `fastify-plugin` for encapsulation
- Chain hooks in logical order

### Don't

- Perform heavy operations in hooks
- Modify request.body directly (immutable after parsing)
- Skip error handling
- Mix business logic into hooks
- Create circular dependencies
- Ignore hook order
- Use hooks for simple validation (use schemas)
- Block the event loop

---

## Hook Order Example

```typescript
app.addHook('onRequest', async (request, reply) => {
  console.log('1. onRequest');
});

app.addHook('preParsing', async (request, reply) => {
  console.log('2. preParsing');
});

app.addHook('preValidation', async (request, reply) => {
  console.log('3. preValidation');
});

app.addHook('preHandler', async (request, reply) => {
  console.log('4. preHandler');
});

app.get('/test', async (request, reply) => {
  console.log('5. handler');
  return { message: 'test' };
});

app.addHook('preSerialization', async (request, reply, payload) => {
  console.log('6. preSerialization');
  return payload;
});

app.addHook('onSend', async (request, reply, payload) => {
  console.log('7. onSend');
  return payload;
});

app.addHook('onResponse', async (request, reply) => {
  console.log('8. onResponse');
});
```

---

## Related Documentation

- [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)
- [Fastify Plugins](https://fastify.dev/docs/latest/Reference/Plugins/)
- [API_STANDARDS.md](./API_STANDARDS.md)
- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md)
