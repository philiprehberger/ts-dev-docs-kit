# Local Development Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide explains how to set up the API Marketplace application for local development.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Application Setup](#application-setup)
5. [Development Workflow](#development-workflow)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: 20+ (see `.nvmrc`)
- **npm**: 10+
- **Docker**: 20+ and Docker Compose
- **Git**: 2.30+

### Optional Tools

- **nvm**: Node version manager (recommended)
- **Postman/Insomnia**: API testing
- **TablePlus/DBeaver**: Database GUI

### Install Node.js

```bash
# Using nvm (recommended)
nvm install
nvm use

# Verify
node --version  # Should be 20+
npm --version   # Should be 10+
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd api-marketplace-app
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 4. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update .env with the generated secret
# JWT_SECRET=<paste-generated-secret-here>
```

### 5. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### 6. Start Development Servers

```bash
# Start all services (API + Web)
npm run dev

# Or start individually
npm run dev --filter=@api-marketplace/api
npm run dev --filter=@api-marketplace/web
```

### 7. Access Applications

- **API Server**: http://localhost:4000
- **API Health**: http://localhost:4000/health/live
- **Web App**: http://localhost:3000
- **API Docs**: http://localhost:4000/docs (if Swagger enabled)

---

## Infrastructure Setup

### Docker Compose Services

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: marketplace
      POSTGRES_PASSWORD: marketplace_dev
      POSTGRES_DB: api_marketplace
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
```

### Start/Stop Infrastructure

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Verify Infrastructure

```bash
# Check PostgreSQL
docker exec -it api-marketplace-app-postgres-1 psql -U marketplace -d api_marketplace

# Check Redis
docker exec -it api-marketplace-app-redis-1 redis-cli ping
# Should return: PONG
```

---

## Application Setup

### Workspace Structure

```
api-marketplace-app/
├── apps/
│   ├── api/              # Backend API (Fastify)
│   └── web/              # Frontend (Next.js)
├── packages/
│   └── shared/           # Shared code
├── docker-compose.yml    # Infrastructure
└── package.json          # Turborepo config
```

### Environment Variables

Create `.env` in project root:

```bash
# ─── Database ───────────────────────────────────────────
DATABASE_URL=postgresql://marketplace:marketplace_dev@localhost:5432/api_marketplace

# ─── Redis ──────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Authentication ─────────────────────────────────────
JWT_SECRET=<generate-64-char-random-string>

# OAuth (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/v1/auth/oauth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:4000/v1/auth/oauth/github/callback

# ─── API Server ─────────────────────────────────────────
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000

# ─── Frontend ───────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000/v1
```

### Generate Prisma Client

```bash
# From root or apps/api/
npm run db:generate

# This generates TypeScript types from Prisma schema
```

### Database Migrations

```bash
# Run all migrations
npm run db:migrate

# Create new migration
cd apps/api
npx prisma migrate dev --name add_new_field

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Seed Database

```bash
# Run seed script
npm run db:seed

# Seed script location: apps/api/prisma/seed.ts
```

---

## Development Workflow

### Running Development Servers

```bash
# All services with hot reload
npm run dev

# API only (port 4000)
npm run dev --filter=@api-marketplace/api

# Frontend only (port 3000)
npm run dev --filter=@api-marketplace/web

# Build all packages
npm run build

# Build specific package
npm run build --filter=@api-marketplace/api
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run tests for specific package
npm run test --filter=@api-marketplace/api

# Run with coverage
npm run test -- --coverage
```

### Linting and Type Checking

```bash
# Lint all packages
npm run lint

# Type check
npm run lint --filter=@api-marketplace/api
```

### Database Operations

```bash
# View database in browser
cd apps/api
npx prisma studio
# Opens at http://localhost:5555

# Check migration status
npx prisma migrate status

# Create migration
npx prisma migrate dev --name description

# Apply migrations (production)
npx prisma migrate deploy
```

### Viewing Logs

```bash
# API logs (with pino-pretty)
cd apps/api
npm run dev
# Logs are automatically pretty-printed in development

# Infrastructure logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 4000
lsof -ti:4000

# Kill process
kill -9 $(lsof -ti:4000)

# Or change PORT in .env
PORT=4001
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection
docker exec -it api-marketplace-app-postgres-1 psql -U marketplace -d api_marketplace
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps

# Test connection
docker exec -it api-marketplace-app-redis-1 redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Prisma Issues

```bash
# Regenerate Prisma client
npm run db:generate

# Check Prisma version
npx prisma --version

# Format schema
npx prisma format
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clean turbo cache
rm -rf .turbo
npm run clean
npm run build
```

### TypeScript Errors

```bash
# Check for errors
npx tsc --noEmit

# Rebuild
npm run build

# Clear build cache
rm -rf apps/*/dist packages/*/dist
npm run build
```

---

## Development Tips

### Hot Reload

All services support hot reload:
- **API**: Uses `tsx watch` for instant TypeScript reload
- **Web**: Next.js Fast Refresh for React components
- **Changes to `shared` package**: Automatically trigger rebuilds

### VSCode Setup

Recommended extensions:
- **Prisma**: Syntax highlighting for `.prisma` files
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Thunder Client**: API testing (alternative to Postman)

### Database Inspection

```bash
# Open Prisma Studio
cd apps/api
npx prisma studio

# Or use PostgreSQL directly
docker exec -it api-marketplace-app-postgres-1 psql -U marketplace -d api_marketplace

# Useful SQL commands
\dt             # List tables
\d users        # Describe users table
\q              # Quit
```

### API Testing

```bash
# Test health endpoint
curl http://localhost:4000/health/live

# Test authenticated endpoint (replace with real JWT)
curl -H "Authorization: Bearer <jwt-token>" \
  http://localhost:4000/v1/profile

# Using httpie (alternative)
http :4000/health/live
http :4000/v1/profile "Authorization: Bearer <token>"
```

---

## Common Commands Reference

```bash
# Development
npm run dev                  # Start all services
npm run dev -- --filter=api  # Start API only
npm run build                # Build all packages
npm run lint                 # Lint all packages
npm run test                 # Run all tests

# Database
npm run db:generate          # Generate Prisma client
npm run db:migrate          # Run migrations
npm run db:seed             # Seed database

# Infrastructure
docker-compose up -d        # Start services
docker-compose down         # Stop services
docker-compose logs -f      # View logs
docker-compose restart      # Restart services

# Individual Apps
cd apps/api
npm run dev                 # Start API server
npm run build              # Build API
npm test                   # Test API

cd apps/web
npm run dev                # Start Next.js
npm run build              # Build Next.js
npm run start              # Run production build
```

---

## Next Steps

After setup:
1. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow
2. Check [API_STANDARDS.md](./API_STANDARDS.md) for API patterns
3. Review [DATABASE_PATTERNS.md](./DATABASE_PATTERNS.md) for Prisma usage
4. See [TESTING_STANDARDS.md](./TESTING_STANDARDS.md) for testing guide

---

## Related Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CONFIGURATION.md](./CONFIGURATION.md)
- [DATABASE_PATTERNS.md](./DATABASE_PATTERNS.md)
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
