# Configuration Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents configuration management for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Configuration Files](#configuration-files)
4. [Environment Validation](#environment-validation)
5. [Configuration Patterns](#configuration-patterns)
6. [Best Practices](#best-practices)

---

## Overview

Configuration is managed through environment variables and TypeScript configuration files.

### Configuration Layers

| Layer | Purpose | Example |
|-------|---------|---------|
| `.env` | Environment-specific values | `DATABASE_URL`, `PORT` |
| `config/*.ts` | Application configuration | Database settings, Redis config |
| `package.json` | Build and dependency config | Scripts, versions |
| `tsconfig.json` | TypeScript compiler config | Target, paths |

---

## Environment Variables

### Environment File Structure

```bash
# .env.example - Template (commit to git)
# .env - Actual values (never commit!)
# .env.local - Local overrides (never commit!)

# ─── Database ───────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/api_marketplace

# ─── Redis ──────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Authentication ─────────────────────────────────────
JWT_SECRET=change-me-to-a-random-64-char-string

# OAuth (Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/v1/auth/oauth/google/callback

# OAuth (GitHub)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:4000/v1/auth/oauth/github/callback

# ─── API Server ─────────────────────────────────────────
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000

# ─── Frontend ───────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000/v1

# ─── External Services (Optional) ───────────────────────
# AWS_REGION=us-east-1
# S3_PAYLOAD_BUCKET=api-marketplace-payloads
# SENTRY_DSN=https://...
```

### Loading Environment Variables

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Define schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Optional services
  AWS_REGION: z.string().optional(),
  S3_PAYLOAD_BUCKET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

// Validate and export
export const env = envSchema.parse(process.env);

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>;
```

### Using Environment Variables

```typescript
// apps/api/src/server.ts
import { env } from './config/env';

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
});

await app.listen({
  port: env.PORT,
  host: env.HOST,
});
```

---

## Configuration Files

### Database Configuration

```typescript
// apps/api/src/config/database.ts
import { env } from './env';

export const databaseConfig = {
  url: env.DATABASE_URL,
  connectionLimit: env.NODE_ENV === 'production' ? 20 : 5,
  poolTimeout: 30, // seconds
  logQueries: env.NODE_ENV === 'development',
};
```

### Redis Configuration

```typescript
// apps/api/src/config/redis.ts
import { env } from './env';
import type { RedisOptions } from 'ioredis';

export const redisConfig: RedisOptions = {
  // Parse URL or use individual options
  ...(env.REDIS_URL ? { url: env.REDIS_URL } : {
    host: 'localhost',
    port: 6379,
  }),
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 1000, 3000); // Exponential backoff
  },
  lazyConnect: true,
};
```

### Rate Limit Configuration

```typescript
// apps/api/src/config/rate-limit.ts
import { env } from './env';

export const rateLimitConfig = {
  global: {
    max: 100,
    timeWindow: '15 minutes',
  },
  auth: {
    login: {
      max: 5,
      timeWindow: '15 minutes',
    },
    register: {
      max: 3,
      timeWindow: '1 hour',
    },
  },
  gateway: {
    max: env.NODE_ENV === 'production' ? 1000 : 10000,
    timeWindow: '1 hour',
  },
};
```

### CORS Configuration

```typescript
// apps/api/src/config/cors.ts
import { env } from './env';

export const corsConfig = {
  origin: env.CORS_ORIGIN.split(',').map(o => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  maxAge: 600,
};
```

### Logger Configuration

```typescript
// apps/api/src/config/logger.ts
import { env } from './env';
import type { LoggerOptions } from 'pino';

export const loggerConfig: LoggerOptions = {
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
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
      };
    },
    res(reply) {
      return {
        statusCode: reply.statusCode,
      };
    },
  },
};
```

---

## Environment Validation

### Startup Validation

```typescript
// apps/api/src/server.ts
import { env } from './config/env';

// Environment is validated on import
// If validation fails, app won't start

app.log.info({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
}, 'Configuration loaded');
```

### Required vs Optional

```typescript
// Required in all environments
const requiredSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

// Optional with defaults
const optionalSchema = z.object({
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
});

// Environment-specific requirements
const productionSchema = z.object({
  SENTRY_DSN: z.string().url(),  // Required in production
  AWS_REGION: z.string(),
});

const envSchema = requiredSchema
  .merge(optionalSchema)
  .merge(
    process.env.NODE_ENV === 'production'
      ? productionSchema
      : z.object({})
  );
```

### Custom Validation Rules

```typescript
const envSchema = z.object({
  DATABASE_URL: z.string()
    .url()
    .refine(
      (url) => url.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection string'
    ),

  JWT_SECRET: z.string()
    .refine(
      (secret) => {
        // Check entropy
        const uniqueChars = new Set(secret).size;
        return uniqueChars > 20;
      },
      'JWT_SECRET must have sufficient entropy'
    ),

  CORS_ORIGIN: z.string()
    .transform((val) => val.split(',').map(v => v.trim()))
    .refine(
      (origins) => {
        if (process.env.NODE_ENV === 'production') {
          return !origins.includes('*');
        }
        return true;
      },
      'CORS_ORIGIN cannot be * in production'
    ),
});
```

---

## Configuration Patterns

### Feature Flags

```typescript
// apps/api/src/config/features.ts
import { env } from './env';

export const features = {
  oauth: {
    google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    github: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
  },
  storage: {
    s3: !!env.AWS_REGION && !!env.S3_PAYLOAD_BUCKET,
  },
  monitoring: {
    sentry: !!env.SENTRY_DSN,
  },
};

// Usage
if (features.oauth.google) {
  await app.register(googleOAuthPlugin);
}

if (features.monitoring.sentry) {
  Sentry.init({ dsn: env.SENTRY_DSN });
}
```

### Environment-Specific Config

```typescript
// apps/api/src/config/index.ts
import { env } from './env';

const baseConfig = {
  api: {
    timeout: 30000,
    retries: 3,
  },
  cache: {
    ttl: 3600,
  },
};

const developmentConfig = {
  ...baseConfig,
  api: {
    ...baseConfig.api,
    timeout: 60000, // Longer timeout in dev
  },
  cache: {
    ttl: 60, // Short cache in dev
  },
};

const productionConfig = {
  ...baseConfig,
  api: {
    ...baseConfig.api,
    timeout: 10000, // Stricter timeout in prod
  },
  cache: {
    ttl: 3600, // Long cache in prod
  },
};

export const config = env.NODE_ENV === 'production'
  ? productionConfig
  : developmentConfig;
```

### Typed Configuration

```typescript
// apps/api/src/config/types.ts
export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    url: string;
    poolSize: number;
  };
  redis: {
    url: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiry: string;
  };
}

// apps/api/src/config/index.ts
import { env } from './env';
import type { AppConfig } from './types';

export const config: AppConfig = {
  server: {
    port: env.PORT,
    host: env.HOST,
  },
  database: {
    url: env.DATABASE_URL,
    poolSize: env.NODE_ENV === 'production' ? 20 : 5,
  },
  redis: {
    url: env.REDIS_URL,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiry: '24h',
  },
};
```

---

## Best Practices

### Do

- Use `.env.example` as template (commit to git)
- Never commit `.env` or `.env.local`
- Validate environment variables on startup
- Use Zod for validation
- Provide defaults for optional values
- Use descriptive variable names
- Group related variables with prefixes
- Document required vs optional variables
- Use TypeScript for configuration
- Fail fast on invalid configuration

### Don't

- Hardcode secrets in code
- Commit `.env` files
- Use different variable names across environments
- Skip validation
- Use `process.env` directly everywhere
- Store secrets in git
- Use weak JWT secrets (< 32 chars)
- Allow `CORS_ORIGIN=*` in production
- Skip environment-specific validation

### Configuration Checklist

- [ ] `.env.example` exists and is up-to-date
- [ ] `.env` is in `.gitignore`
- [ ] All required variables validated on startup
- [ ] JWT secret is strong (64+ characters)
- [ ] Database URL is validated
- [ ] CORS is properly configured
- [ ] Environment-specific configs exist
- [ ] TypeScript types for all config
- [ ] Secrets not hardcoded
- [ ] Feature flags for optional features

---

## Example: Full Configuration Setup

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export const env = envSchema.parse(process.env);

// apps/api/src/config/index.ts
import { env } from './env';

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',

  server: {
    port: env.PORT,
    host: env.HOST,
  },

  database: {
    url: env.DATABASE_URL,
    poolSize: env.NODE_ENV === 'production' ? 20 : 5,
  },

  redis: {
    url: env.REDIS_URL,
  },

  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiry: '24h',
  },

  cors: {
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  },

  logging: {
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === 'development',
  },
};

// apps/api/src/server.ts
import { config } from './config';

const app = Fastify({
  logger: {
    level: config.logging.level,
  },
});

await app.listen({
  port: config.server.port,
  host: config.server.host,
});
```

---

## Related Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
