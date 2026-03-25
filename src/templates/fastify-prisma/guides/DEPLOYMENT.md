# Deployment Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers, DevOps

This guide documents deployment procedures for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Build Process](#build-process)
4. [Deployment Strategies](#deployment-strategies)
5. [Environment Configuration](#environment-configuration)
6. [Database Migrations](#database-migrations)
7. [Health Checks](#health-checks)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring](#monitoring)

---

## Overview

### Deployment Architecture

- **Application**: Node.js 20+ with TypeScript
- **Process Manager**: PM2 for production
- **Reverse Proxy**: Nginx
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **SSL**: Let's Encrypt

### Zero-Downtime Deployment

The deployment process ensures zero downtime:
1. Build new version
2. Run database migrations
3. Start new processes
4. Health check new version
5. Switch traffic
6. Gracefully shutdown old version

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 22.04 LTS or newer
- **Node.js**: 20.x LTS
- **PostgreSQL**: 16+
- **Redis**: 7+
- **Nginx**: 1.18+
- **PM2**: Latest
- **Memory**: 2GB+ RAM recommended

### Install Dependencies on Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

---

## Build Process

### Local Build

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# This creates:
# - apps/api/dist/
# - apps/web/.next/
# - packages/shared/dist/
```

### Production Build

```bash
# Set NODE_ENV
export NODE_ENV=production

# Install production dependencies only
npm ci --omit=dev

# Build
npm run build

# Generate Prisma client
npm run db:generate
```

### Build Artifacts

```
api-marketplace-app/
├── apps/
│   ├── api/
│   │   └── dist/           # Compiled TypeScript
│   └── web/
│       └── .next/          # Next.js build
├── packages/
│   └── shared/
│       └── dist/           # Compiled shared code
├── node_modules/           # Production dependencies
└── package.json
```

---

## Deployment Strategies

### Option 1: PM2 Ecosystem (Recommended)

#### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api-marketplace-api',
      cwd: './apps/api',
      script: 'dist/server.js',
      instances: 'max',  // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/var/log/pm2/api-error.log',
      out_file: '/var/log/pm2/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      wait_ready: true,
      listen_timeout: 10000,
    },
    {
      name: 'api-marketplace-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/web-error.log',
      out_file: '/var/log/pm2/web-out.log',
    },
    {
      name: 'api-marketplace-worker',
      cwd: './apps/api',
      script: 'dist/worker.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

#### Deploy with PM2

```bash
# Initial deployment
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Deploy updates (zero-downtime)
pm2 reload ecosystem.config.js

# View status
pm2 status
pm2 logs

# Monitor
pm2 monit
```

### Option 2: Docker Deployment

#### Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --omit=dev

# Build the app
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build --filter=@api-marketplace/api

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

USER nodejs
EXPOSE 4000

CMD ["node", "dist/server.js"]
```

#### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - '4000:4000'
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    depends_on:
      - api
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
      - web
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

---

## Environment Configuration

### Production Environment Variables

```bash
# .env.production
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@db.example.com:5432/api_marketplace

# Redis
REDIS_URL=redis://redis.example.com:6379

# Authentication
JWT_SECRET=<64-char-secure-random-string>

# OAuth (if enabled)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.example.com/v1/auth/oauth/google/callback

# API Server
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info
CORS_ORIGIN=https://example.com,https://www.example.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.example.com/v1

# Optional Services
SENTRY_DSN=https://...
AWS_REGION=us-east-1
S3_PAYLOAD_BUCKET=api-marketplace-payloads
```

### Environment Variable Management

```bash
# Use secrets management service
# AWS Secrets Manager, HashiCorp Vault, etc.

# Or secure .env file
sudo mkdir -p /var/www/api-marketplace-app/shared
sudo nano /var/www/api-marketplace-app/shared/.env
sudo chmod 600 /var/www/api-marketplace-app/shared/.env
```

---

## Database Migrations

### Running Migrations

```bash
# Check migration status
cd apps/api
npx prisma migrate status

# Apply migrations (production)
npx prisma migrate deploy

# This runs all pending migrations
```

### Migration Strategy

1. **Test migrations in staging first**
2. **Backup database before migration**
3. **Run migrations before deploying code**
4. **Use transactions for data migrations**

```bash
# Backup database
pg_dump -h db.example.com -U user api_marketplace > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npx prisma migrate deploy

# If issues occur, restore from backup
psql -h db.example.com -U user api_marketplace < backup_20240325_120000.sql
```

### Zero-Downtime Migration Pattern

```bash
# 1. Add new column (nullable)
npx prisma migrate deploy

# 2. Deploy code that writes to both old and new columns
pm2 reload ecosystem.config.js

# 3. Backfill data
node scripts/backfill-new-column.js

# 4. Deploy code that reads from new column
pm2 reload ecosystem.config.js

# 5. Remove old column in next migration
```

---

## Health Checks

### Implementing Health Endpoints

```typescript
// apps/api/src/modules/health.ts
export async function healthRoutes(app: FastifyInstance) {
  // Liveness check (is process running?)
  app.get('/health/live', async (request, reply) => {
    return { status: 'ok' };
  });

  // Readiness check (can handle traffic?)
  app.get('/health/ready', async (request, reply) => {
    try {
      // Check database
      await app.prisma.$queryRaw`SELECT 1`;

      // Check Redis
      await app.redis.ping();

      return {
        status: 'ok',
        checks: {
          database: 'ok',
          redis: 'ok',
        },
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'error',
        error: error.message,
      };
    }
  });
}
```

### PM2 Health Check

```javascript
// In ecosystem.config.js
{
  name: 'api',
  health_check_grace_period: 10000,
  health_check_url: 'http://localhost:4000/health/ready',
  wait_ready: true,
}
```

### Load Balancer Health Check

```nginx
# Nginx health check
upstream api_backend {
  server localhost:4000 max_fails=3 fail_timeout=30s;
  server localhost:4001 max_fails=3 fail_timeout=30s;
}

location /health/ready {
  proxy_pass http://api_backend;
  proxy_connect_timeout 2s;
  proxy_read_timeout 2s;
}
```

---

## Rollback Procedures

### PM2 Rollback

```bash
# Save current state
pm2 save

# If deployment fails, rollback
pm2 reload ecosystem.config.js --update-env

# Or restart with previous code
cd /var/www/api-marketplace-app/previous-release
pm2 reload ecosystem.config.js
```

### Database Rollback

```bash
# Restore from backup
pg_restore -h db.example.com -U user -d api_marketplace backup.sql

# Or rollback specific migrations (not recommended)
# Prisma doesn't support migration rollback
# Instead, create new migration that reverts changes
```

### Blue-Green Deployment

```bash
# Keep two versions running
pm2 start ecosystem.config.js --name api-blue
pm2 start ecosystem.config.js --name api-green

# Switch Nginx upstream
sudo nano /etc/nginx/sites-available/api-marketplace
# Change upstream to api-green

sudo nginx -t
sudo systemctl reload nginx

# If issues, switch back to api-blue
```

---

## Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs
pm2 logs api-marketplace-api --lines 100

# Monitor resources
pm2 monit

# PM2 Plus (paid)
pm2 link <secret> <public>
```

### Application Metrics

```typescript
// Use prom-client for Prometheus metrics
import client from 'prom-client';

const register = new client.Registry();

// Collect default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Expose metrics endpoint
app.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

### Error Tracking

```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// In error handler
app.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error);
  // ... rest of error handling
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Tests passing locally
- [ ] Build succeeds
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup database
- [ ] Review changes in staging

### Deployment

- [ ] Build production artifacts
- [ ] Upload to server
- [ ] Run database migrations
- [ ] Start new processes
- [ ] Health checks pass
- [ ] Switch traffic
- [ ] Monitor logs and metrics

### Post-Deployment

- [ ] Verify application functionality
- [ ] Check error rates
- [ ] Monitor performance metrics
- [ ] Test critical user flows
- [ ] Document any issues

---

## Related Documentation

- [CONFIGURATION.md](./CONFIGURATION.md)
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [DATABASE_PATTERNS.md](./DATABASE_PATTERNS.md)
- [SECURITY.md](./SECURITY.md)
- [MONITORING.md](./MONITORING.md)
