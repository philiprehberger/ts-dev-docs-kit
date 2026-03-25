# Logging Standards Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents logging standards and best practices for the API Marketplace application using Pino.

---

## Table of Contents

1. [Overview](#overview)
2. [Log Levels](#log-levels)
3. [Configuration](#configuration)
4. [Usage Patterns](#usage-patterns)
5. [Structured Logging](#structured-logging)
6. [Child Loggers](#child-loggers)
7. [Sensitive Data](#sensitive-data)
8. [Best Practices](#best-practices)

---

## Overview

Fastify uses **Pino** for logging, one of the fastest Node.js loggers with excellent structured logging support.

### Key Features

- **Fast**: Minimal performance impact
- **Structured**: JSON output for easy parsing
- **Levels**: Standard syslog severity levels
- **Child Loggers**: Contextual logging
- **Request IDs**: Automatic correlation

---

## Log Levels

Pino supports standard syslog levels (in order of severity):

| Level | Numeric | Usage |
|-------|---------|-------|
| `fatal` | 60 | Application cannot continue |
| `error` | 50 | Runtime errors |
| `warn` | 40 | Warning conditions |
| `info` | 30 | Informational messages (default) |
| `debug` | 20 | Debug information |
| `trace` | 10 | Very detailed debug info |

### When to Use Each Level

```typescript
// FATAL: Application cannot continue
app.log.fatal({ err: error, component: 'database' }, 'Database connection lost');
process.exit(1);

// ERROR: Runtime errors that require attention
app.log.error(
  { err: error, userId, creditCost },
  'Failed to deduct credits'
);

// WARN: Warning conditions, degraded functionality
app.log.warn(
  { creditsRemaining: 10, userId },
  'User credits running low'
);

// INFO: Normal significant events (default level)
app.log.info(
  { userId, tokenId },
  'API token created'
);

// DEBUG: Debug information for development
app.log.debug(
  { query: sql, params },
  'Database query executed'
);

// TRACE: Very detailed debug (usually disabled)
app.log.trace(
  { headers: request.headers },
  'Request headers'
);
```

---

## Configuration

### Basic Setup

```typescript
// apps/api/src/server.ts
import Fastify from 'fastify';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined, // JSON in production
  },
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID(),
});
```

### Development Configuration (Pretty Printing)

```bash
# Install pino-pretty for development
npm install -D pino-pretty
```

```typescript
// Development logger with pretty printing
const app = Fastify({
  logger: {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  },
});
```

### Production Configuration (JSON)

```typescript
// Production logger (JSON output)
const app = Fastify({
  logger: {
    level: 'info',
    // No transport = JSON output
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          headers: {
            host: request.headers.host,
            'user-agent': request.headers['user-agent'],
          },
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
});
```

### Environment Variables

```bash
# .env
LOG_LEVEL=info              # trace, debug, info, warn, error, fatal
NODE_ENV=production         # development, production
```

---

## Usage Patterns

### Basic Logging

```typescript
// Simple message
app.log.info('Server started');

// With data
app.log.info({ port: 4000 }, 'Server listening');

// Error logging
app.log.error({ err: error }, 'Failed to process request');
```

### Request Logging

```typescript
// Fastify automatically logs requests
// Customize with hooks
app.addHook('onRequest', (request, reply, done) => {
  request.log.info(
    { userId: request.user?.id },
    'Request started'
  );
  done();
});

app.addHook('onResponse', (request, reply, done) => {
  request.log.info(
    {
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    },
    'Request completed'
  );
  done();
});
```

### Error Logging

```typescript
// In error handler
app.setErrorHandler((error, request, reply) => {
  // Log with context
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
    userId: request.user?.id,
    requestId: request.id,
  }, 'Request error');

  // Send response
  reply.code(500).send({ error: 'Internal Server Error' });
});
```

### Business Logic Logging

```typescript
// Credit deduction
async function deductCredits(userId: bigint, amount: number) {
  app.log.info(
    { userId, amount, operation: 'credit_deduction' },
    'Starting credit deduction'
  );

  try {
    await prisma.$transaction([...]);

    app.log.info(
      { userId, amount },
      'Credit deduction successful'
    );
  } catch (error) {
    app.log.error(
      { err: error, userId, amount },
      'Credit deduction failed'
    );
    throw error;
  }
}
```

---

## Structured Logging

### Object-First Pattern

```typescript
// Good - Structured data first, message second
app.log.info(
  {
    userId: 123n,
    tokenId: 456n,
    action: 'token_created',
  },
  'API token created'
);

// Bad - String interpolation loses structure
app.log.info(`API token ${tokenId} created for user ${userId}`);
```

### Consistent Field Names

```typescript
// Use consistent field names across the application
const LogFields = {
  // IDs
  userId: 'userId',
  tokenId: 'tokenId',
  apiId: 'apiId',
  transactionId: 'transactionId',

  // Operations
  operation: 'operation',
  action: 'action',

  // Errors
  err: 'err',
  errorCode: 'errorCode',

  // Performance
  duration: 'duration',
  responseTime: 'responseTime',

  // Request context
  requestId: 'requestId',
  method: 'method',
  url: 'url',
  statusCode: 'statusCode',
};

// Usage
app.log.info({
  userId: user.id,
  operation: 'token_creation',
  duration: Date.now() - startTime,
}, 'Token created successfully');
```

### Searchable Fields

```typescript
// Make logs searchable by including key fields
app.log.error({
  err: error,
  userId: user.id,
  apiId: api.id,
  operation: 'api_request',
  endpoint: '/v1/data',
  requestId: request.id,
  // Easy to search: "operation=api_request AND apiId=5"
}, 'API request failed');
```

---

## Child Loggers

### Creating Child Loggers

```typescript
// Add context to all logs from a module
export async function tokensModule(app: FastifyInstance) {
  // Create child logger with module context
  const log = app.log.child({ module: 'tokens' });

  app.post('/tokens', async (request, reply) => {
    // Create request-specific child logger
    const requestLog = log.child({
      userId: request.user.id,
      requestId: request.id,
    });

    requestLog.info('Creating token');

    const token = await createToken(request.body);

    requestLog.info({ tokenId: token.id }, 'Token created');

    return token;
  });
}
```

### Per-Request Logger

```typescript
// Fastify provides request.log with request context
app.get('/users/:id', async (request, reply) => {
  // request.log automatically includes request info
  request.log.info('Fetching user');

  const user = await getUser(request.params.id);

  request.log.info({ userId: user.id }, 'User fetched');

  return user;
});
```

### Service-Level Logger

```typescript
// Service with logger dependency injection
export class CreditService {
  constructor(private log: pino.Logger) {}

  async deductCredits(userId: bigint, amount: number) {
    const opLog = this.log.child({
      userId,
      amount,
      operation: 'credit_deduction',
    });

    opLog.debug('Starting credit deduction');

    try {
      // ... deduction logic
      opLog.info('Credit deduction successful');
    } catch (error) {
      opLog.error({ err: error }, 'Credit deduction failed');
      throw error;
    }
  }
}

// Usage
const creditService = new CreditService(app.log.child({ service: 'credit' }));
```

---

## Sensitive Data

### Never Log Sensitive Data

```typescript
// Never log these
❌ Passwords
❌ API keys/tokens (full value)
❌ Credit card numbers
❌ Social security numbers
❌ Private keys
❌ Session tokens

// Safe to log (with caution)
✅ User IDs
✅ Token prefixes (mkp_live_abc...)
✅ Email addresses (depends on privacy policy)
✅ Timestamps
✅ Status codes
✅ Error messages (non-sensitive)
```

### Redacting Sensitive Data

```typescript
// Custom serializer to redact sensitive fields
const app = Fastify({
  logger: {
    level: 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          headers: {
            // Redact authorization header
            ...request.headers,
            authorization: request.headers.authorization
              ? '[REDACTED]'
              : undefined,
          },
        };
      },
    },
  },
});

// Redact function for objects
function redact(obj: Record<string, any>, fields: string[]) {
  const copy = { ...obj };
  for (const field of fields) {
    if (copy[field]) {
      copy[field] = '[REDACTED]';
    }
  }
  return copy;
}

// Usage
app.log.info(
  redact(user, ['passwordHash', 'apiKey']),
  'User created'
);
```

### Token Logging

```typescript
// Good - Log token prefix only
app.log.info(
  { tokenPrefix: token.tokenPrefix }, // mkp_live_abc...
  'Token created'
);

// Bad - Never log full token
app.log.info(
  { token: token.rawValue }, // ❌ Exposes full token
  'Token created'
);
```

---

## Best Practices

### Do

- Use structured logging with objects
- Include request IDs for tracing
- Log at appropriate levels
- Use child loggers for context
- Log errors with full context
- Include operation/action fields
- Use consistent field names
- Log business events (token created, credits deducted)
- Log performance metrics
- Configure different levels for dev/prod

### Don't

- Log sensitive data (passwords, tokens, keys)
- Use string concatenation/interpolation
- Log in hot code paths excessively
- Ignore log levels (use appropriate level)
- Log the same information multiple times
- Include PII without necessity
- Log request bodies without sanitization
- Use console.log (use app.log instead)

### Examples

```typescript
// ✅ Good - Structured, contextual
app.log.info({
  userId: user.id,
  operation: 'token_creation',
  tokenId: token.id,
  duration: 45,
}, 'Token created successfully');

// ❌ Bad - Unstructured, hard to search
app.log.info(`Token ${token.id} created for user ${user.id} in 45ms`);

// ✅ Good - Error with context
app.log.error({
  err: error,
  userId: user.id,
  operation: 'credit_deduction',
  amount: 100,
  requestId: request.id,
}, 'Credit deduction failed');

// ❌ Bad - Missing context
app.log.error(error);

// ✅ Good - Debug with details
app.log.debug({
  query: 'SELECT * FROM users WHERE id = ?',
  params: [userId],
  duration: 5,
}, 'Database query executed');

// ❌ Bad - Too much detail in info
app.log.info({
  query: '...',  // Debug info at wrong level
  params: [...],
}, 'Query executed');
```

---

## Log Aggregation

### Production Log Management

For production, send logs to aggregation service:

```typescript
// Using pino-elasticsearch
const app = Fastify({
  logger: {
    level: 'info',
    stream: createWriteStream({
      node: process.env.ELASTICSEARCH_URL,
      index: 'api-marketplace-logs',
    }),
  },
});

// Or using a service like Datadog, New Relic, etc.
```

### Searching Logs

```bash
# With JSON logs, use jq for local searching
cat logs/app.log | jq 'select(.userId == 123)'
cat logs/app.log | jq 'select(.level >= 50)' # Errors only
cat logs/app.log | jq 'select(.operation == "credit_deduction")'
```

---

## Related Documentation

- [Pino Documentation](https://getpino.io)
- [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/)
- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [API_STANDARDS.md](./API_STANDARDS.md)
