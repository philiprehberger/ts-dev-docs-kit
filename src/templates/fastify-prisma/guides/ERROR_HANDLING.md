# Error Handling Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents error handling patterns and best practices for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [Error Types](#error-types)
3. [Custom Error Classes](#custom-error-classes)
4. [Fastify Error Handler](#fastify-error-handler)
5. [HTTP Status Codes](#http-status-codes)
6. [Error Responses](#error-responses)
7. [Logging Errors](#logging-errors)

---

## Overview

Proper error handling ensures:
- Users see helpful messages, not stack traces
- Developers get detailed information for debugging
- Security-sensitive details are not exposed
- Errors are logged appropriately
- Type-safe error handling

### Error Handling Layers

| Layer | Responsibility |
|-------|---------------|
| Validation | Zod schemas validate input |
| Business Logic | Services throw domain errors |
| Route Handler | Catches errors, delegates to error handler |
| Error Handler | Global handling, logging, formatting |

---

## Error Types

### Built-in Error Classes

```typescript
// HTTP errors from @fastify/sensible
app.register(require('@fastify/sensible'));

// Usage in routes
app.get('/users/:id', async (request, reply) => {
  const user = await getUser(request.params.id);

  if (!user) {
    throw app.httpErrors.notFound('User not found');
  }

  return user;
});
```

### Common HTTP Errors

| Method | Status | Description |
|--------|--------|-------------|
| `badRequest()` | 400 | Invalid request |
| `unauthorized()` | 401 | Not authenticated |
| `paymentRequired()` | 402 | Payment required |
| `forbidden()` | 403 | Not authorized |
| `notFound()` | 404 | Resource not found |
| `methodNotAllowed()` | 405 | Method not allowed |
| `conflict()` | 409 | Resource conflict |
| `gone()` | 410 | Resource deleted |
| `unprocessableEntity()` | 422 | Validation failed |
| `tooManyRequests()` | 429 | Rate limit exceeded |
| `internalServerError()` | 500 | Server error |
| `serviceUnavailable()` | 503 | Service unavailable |

---

## Custom Error Classes

### Base Error Class

```typescript
// apps/api/src/lib/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Domain-Specific Errors

```typescript
// Credit system errors
export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits: need ${required}, have ${available}`,
      402, // Payment Required
      'INSUFFICIENT_CREDITS',
      { required, available }
    );
  }
}

export class CreditDeductionError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, 'CREDIT_DEDUCTION_FAILED', details);
  }
}

// Token errors
export class InvalidTokenError extends AppError {
  constructor(message: string = 'Invalid or expired token') {
    super(message, 401, 'INVALID_TOKEN');
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('Token has expired', 401, 'TOKEN_EXPIRED');
  }
}

export class TokenRevokedError extends AppError {
  constructor() {
    super('Token has been revoked', 401, 'TOKEN_REVOKED');
  }
}

// Rate limiting
export class RateLimitExceededError extends AppError {
  constructor(retryAfter: number) {
    super(
      'Rate limit exceeded',
      429,
      'RATE_LIMIT_EXCEEDED',
      { retryAfter }
    );
  }
}

// API Gateway errors
export class UpstreamError extends AppError {
  constructor(
    public apiName: string,
    public upstreamStatus: number,
    message: string
  ) {
    super(
      `Upstream API error: ${message}`,
      502,
      'UPSTREAM_ERROR',
      { apiName, upstreamStatus }
    );
  }
}

// Not Found
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | bigint) {
    const message = id
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', { resource, id });
  }
}

// Validation
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 422, 'VALIDATION_ERROR', fields);
  }
}

// Authorization
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}
```

### Using Custom Errors

```typescript
import { InsufficientCreditsError, NotFoundError } from '../lib/errors';

// In service
export async function deductCredits(
  userId: bigint,
  amount: number
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  if (user.creditsRemaining < amount) {
    throw new InsufficientCreditsError(amount, user.creditsRemaining);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditsRemaining: { decrement: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, amount: -amount, type: 'USAGE' },
    }),
  ]);
}

// In route handler
app.post('/deduct-credits', async (request, reply) => {
  try {
    await deductCredits(request.user.id, request.body.amount);
    return { success: true };
  } catch (error) {
    // Error handler will catch and format
    throw error;
  }
});
```

---

## Fastify Error Handler

### Global Error Handler

```typescript
// apps/api/src/server.ts
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './lib/errors';

app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  // Log error
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      details: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Handle custom application errors
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && error.details
        ? { details: error.details }
        : {}),
    });
  }

  // Handle Fastify HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code || 'CLIENT_ERROR',
    });
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;

    if (prismaError.code === 'P2002') {
      // Unique constraint violation
      return reply.code(409).send({
        error: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
        details: { field: prismaError.meta?.target },
      });
    }

    if (prismaError.code === 'P2025') {
      // Record not found
      return reply.code(404).send({
        error: 'Resource not found',
        code: 'NOT_FOUND',
      });
    }
  }

  // Unexpected errors - hide details in production
  const isProduction = process.env.NODE_ENV === 'production';

  return reply.code(500).send({
    error: isProduction
      ? 'Internal Server Error'
      : error.message,
    code: 'INTERNAL_ERROR',
    ...(isProduction ? {} : { stack: error.stack }),
  });
});
```

### Not Found Handler

```typescript
// Handle 404s
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: request.url,
  });
});
```

---

## HTTP Status Codes

### Status Code Guidelines

| Range | Purpose | When to Use |
|-------|---------|-------------|
| 200-299 | Success | Request succeeded |
| 400-499 | Client Error | Client did something wrong |
| 500-599 | Server Error | Server encountered an error |

### Common Status Codes

**Success (2xx)**
- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `204 No Content` - Success with no response body

**Client Errors (4xx)**
- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - Not authenticated
- `402 Payment Required` - Insufficient credits
- `403 Forbidden` - Not authorized
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded

**Server Errors (5xx)**
- `500 Internal Server Error` - Unexpected error
- `502 Bad Gateway` - Upstream API error
- `503 Service Unavailable` - Service temporarily down

---

## Error Responses

### Standard Error Format

```typescript
interface ErrorResponse {
  error: string;           // Human-readable message
  code: string;            // Machine-readable code
  details?: unknown;       // Additional context (dev mode)
  stack?: string;          // Stack trace (dev mode only)
}
```

### Example Responses

**Validation Error (400)**
```json
{
  "error": "Validation Error",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    },
    {
      "field": "age",
      "message": "Must be at least 18"
    }
  ]
}
```

**Insufficient Credits (402)**
```json
{
  "error": "Insufficient credits: need 100, have 50",
  "code": "INSUFFICIENT_CREDITS",
  "details": {
    "required": 100,
    "available": 50
  }
}
```

**Not Found (404)**
```json
{
  "error": "User with id 123 not found",
  "code": "NOT_FOUND",
  "details": {
    "resource": "User",
    "id": "123"
  }
}
```

**Rate Limit (429)**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 60
  }
}
```

**Internal Error (500 - Production)**
```json
{
  "error": "Internal Server Error",
  "code": "INTERNAL_ERROR"
}
```

**Internal Error (500 - Development)**
```json
{
  "error": "Cannot read property 'id' of undefined",
  "code": "INTERNAL_ERROR",
  "stack": "TypeError: Cannot read property 'id' of undefined\n    at ..."
}
```

---

## Logging Errors

### Error Logging Levels

```typescript
// apps/api/src/server.ts
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// In error handler
app.setErrorHandler((error, request, reply) => {
  // Critical errors (5xx)
  if (!error.statusCode || error.statusCode >= 500) {
    request.log.error({
      err: error,
      url: request.url,
      method: request.method,
      userId: request.user?.id,
    }, 'Server error');
  }
  // Client errors (4xx) - log at warn level
  else {
    request.log.warn({
      err: error,
      url: request.url,
      method: request.method,
    }, 'Client error');
  }

  // ... send response
});
```

### Structured Error Logging

```typescript
// Log with context
request.log.error({
  err: error,
  userId: request.user.id,
  apiId: apiId,
  creditCost: cost,
  operation: 'credit_deduction',
}, 'Credit deduction failed');

// Include request ID for tracing
request.log.error({
  err: error,
  requestId: request.id,
}, 'Upstream API error');
```

### Error Monitoring

```typescript
// Integration with error monitoring (e.g., Sentry)
import * as Sentry from '@sentry/node';

app.setErrorHandler((error, request, reply) => {
  // Send to Sentry for 5xx errors
  if (!error.statusCode || error.statusCode >= 500) {
    Sentry.captureException(error, {
      extra: {
        url: request.url,
        method: request.method,
        userId: request.user?.id,
      },
    });
  }

  // ... rest of error handling
});
```

---

## Best Practices

### Do

- Use custom error classes for domain errors
- Include error codes for client parsing
- Log all 5xx errors with full context
- Hide sensitive details in production
- Use appropriate HTTP status codes
- Provide helpful error messages
- Include request IDs for debugging
- Test error paths thoroughly

### Don't

- Expose stack traces in production
- Return sensitive data in errors
- Use generic "Error" class
- Ignore errors silently
- Use 500 for client errors
- Log passwords or tokens
- Swallow errors without logging
- Return different formats for errors

---

## Testing Error Handling

```typescript
import { describe, it, expect } from 'vitest';
import { InsufficientCreditsError } from './errors';

describe('Error Handling', () => {
  it('should throw InsufficientCreditsError', async () => {
    await expect(deductCredits(userId, 1000))
      .rejects
      .toThrow(InsufficientCreditsError);
  });

  it('should return 402 for insufficient credits', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/deduct-credits',
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 1000 },
    });

    expect(response.statusCode).toBe(402);
    expect(JSON.parse(response.body)).toMatchObject({
      error: expect.stringContaining('Insufficient credits'),
      code: 'INSUFFICIENT_CREDITS',
    });
  });
});
```

---

## Related Documentation

- [Fastify Error Handling](https://fastify.dev/docs/latest/Reference/Errors/)
- [@fastify/sensible](https://github.com/fastify/fastify-sensible)
- [LOGGING_STANDARDS.md](./LOGGING_STANDARDS.md)
- [API_STANDARDS.md](./API_STANDARDS.md)
- [VALIDATION_GUIDE.md](./VALIDATION_GUIDE.md)
