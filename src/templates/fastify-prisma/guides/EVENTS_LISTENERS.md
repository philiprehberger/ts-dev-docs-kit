# Events & Listeners Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide documents event-driven architecture patterns using BullMQ for the API Marketplace application.

---

## Table of Contents

1. [Overview](#overview)
2. [BullMQ Setup](#bullmq-setup)
3. [Creating Jobs](#creating-jobs)
4. [Job Processors](#job-processors)
5. [Event Emitters](#event-emitters)
6. [Job Patterns](#job-patterns)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## Overview

Events and background jobs enable decoupled, asynchronous processing:
- Separate concerns (single responsibility)
- Enable async processing
- Improve response times
- Handle failures gracefully
- Enable retries with backoff

### When to Use Events/Jobs

| Use Events/Jobs | Don't Use |
|----------------|-----------|
| Async operations (emails, webhooks) | Operations requiring immediate feedback |
| Multiple reactions to one action | Simple, synchronous operations |
| Long-running tasks | Performance-critical paths |
| Retry-able operations | Non-idempotent operations |
| Background processing | Real-time responses |

---

## BullMQ Setup

### Installation

```bash
npm install bullmq ioredis
```

### Queue Configuration

```typescript
// apps/api/src/config/queue.ts
import { ConnectionOptions } from 'bullmq';
import { env } from './env';

export const queueConnection: ConnectionOptions = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port) || 6379,
  maxRetriesPerRequest: null, // Required for BullMQ
};

export const queueConfig = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};
```

### Create Queue Manager

```typescript
// apps/api/src/lib/queue-manager.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { queueConnection, queueConfig } from '../config/queue';
import type { Logger } from 'pino';

export class QueueManager {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  constructor(private logger: Logger) {}

  createQueue<T = any>(name: string): Queue<T> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue<T>(name, {
      connection: queueConnection,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });

    this.queues.set(name, queue);
    this.logger.info({ queueName: name }, 'Queue created');

    return queue;
  }

  createWorker<T = any>(
    name: string,
    processor: (job: any) => Promise<any>
  ): Worker<T> {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const worker = new Worker<T>(
      name,
      async (job) => {
        this.logger.info(
          { jobId: job.id, jobName: job.name, queueName: name },
          'Processing job'
        );

        try {
          const result = await processor(job);

          this.logger.info(
            { jobId: job.id, jobName: job.name },
            'Job completed'
          );

          return result;
        } catch (error) {
          this.logger.error(
            { err: error, jobId: job.id, jobName: job.name },
            'Job failed'
          );
          throw error;
        }
      },
      {
        connection: queueConnection,
        concurrency: 5,
      }
    );

    // Handle worker events
    worker.on('failed', (job, err) => {
      this.logger.error(
        { err, jobId: job?.id, attempts: job?.attemptsMade },
        'Job failed after retries'
      );
    });

    this.workers.set(name, worker);
    this.logger.info({ queueName: name }, 'Worker created');

    return worker;
  }

  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queues.values()).map(q => q.close()),
      ...Array.from(this.workers.values()).map(w => w.close()),
    ]);
  }
}
```

---

## Creating Jobs

### Job Types Definition

```typescript
// apps/api/src/jobs/types.ts

export interface UsageLogJob {
  userId: bigint;
  apiId: bigint;
  tokenId: bigint;
  endpointId: bigint;
  creditsUsed: number;
  statusCode: number;
  latencyMs: number;
  timestamp: Date;
}

export interface EmailJob {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  data?: Record<string, any>;
}

export interface RefundJob {
  userId: bigint;
  amount: number;
  referenceKey: string;
  reason: string;
}

export interface WebhookJob {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  retries: number;
}
```

### Queue Names

```typescript
// apps/api/src/jobs/queues.ts

export const QueueNames = {
  USAGE_LOG: 'usage-log',
  EMAIL: 'email',
  REFUND: 'refund',
  WEBHOOK: 'webhook',
  NOTIFICATION: 'notification',
} as const;

export type QueueName = typeof QueueNames[keyof typeof QueueNames];
```

---

## Job Processors

### Usage Logger Job

```typescript
// apps/api/src/jobs/usage-logger.ts
import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { UsageLogJob } from './types';

export class UsageLogProcessor {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  async process(job: Job<UsageLogJob>): Promise<void> {
    const { userId, apiId, tokenId, endpointId, creditsUsed, statusCode, latencyMs, timestamp } = job.data;

    this.logger.debug({ jobId: job.id, userId, apiId }, 'Logging usage');

    await this.prisma.usageLog.create({
      data: {
        userId,
        apiId,
        tokenId,
        endpointId,
        creditsUsed,
        statusCode,
        latencyMs,
        timestamp,
      },
    });
  }
}
```

### Email Job

```typescript
// apps/api/src/jobs/email-sender.ts
import { Job } from 'bullmq';
import type { Logger } from 'pino';
import type { EmailJob } from './types';

export class EmailProcessor {
  constructor(
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async process(job: Job<EmailJob>): Promise<void> {
    const { to, subject, body, templateId, data } = job.data;

    this.logger.info({ jobId: job.id, to, subject }, 'Sending email');

    try {
      await this.emailService.send({
        to,
        subject,
        body,
        templateId,
        data,
      });

      this.logger.info({ jobId: job.id, to }, 'Email sent successfully');
    } catch (error) {
      this.logger.error({ err: error, jobId: job.id, to }, 'Email send failed');
      throw error; // Will trigger retry
    }
  }
}
```

### Refund Job

```typescript
// apps/api/src/jobs/refund-processor.ts
import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { RefundJob } from './types';

export class RefundProcessor {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  async process(job: Job<RefundJob>): Promise<void> {
    const { userId, amount, referenceKey, reason } = job.data;

    this.logger.info({ jobId: job.id, userId, amount }, 'Processing refund');

    try {
      await this.prisma.$transaction([
        // Refund credits
        this.prisma.user.update({
          where: { id: userId },
          data: {
            creditsRemaining: {
              increment: amount,
            },
          },
        }),
        // Log transaction
        this.prisma.creditTransaction.create({
          data: {
            userId,
            amount,
            type: 'REFUND',
            description: `Refund: ${reason}`,
          },
        }),
      ]);

      this.logger.info({ jobId: job.id, userId, amount }, 'Refund completed');
    } catch (error) {
      this.logger.error({ err: error, jobId: job.id }, 'Refund failed');
      throw error;
    }
  }
}
```

### Webhook Job

```typescript
// apps/api/src/jobs/webhook-sender.ts
import { Job } from 'bullmq';
import { fetch } from 'undici';
import type { Logger } from 'pino';
import type { WebhookJob } from './types';

export class WebhookProcessor {
  constructor(private logger: Logger) {}

  async process(job: Job<WebhookJob>): Promise<void> {
    const { url, method, headers, body } = job.data;

    this.logger.info({ jobId: job.id, url, method }, 'Sending webhook');

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      this.logger.info({ jobId: job.id, url, status: response.status }, 'Webhook sent');
    } catch (error) {
      this.logger.error({ err: error, jobId: job.id, url }, 'Webhook failed');
      throw error;
    }
  }
}
```

---

## Event Emitters

### Application Events

```typescript
// apps/api/src/events/emitter.ts
import { EventEmitter } from 'events';
import type { Logger } from 'pino';

export class AppEventEmitter extends EventEmitter {
  constructor(private logger: Logger) {
    super();
  }

  emitAsync(event: string, data: any): void {
    this.logger.debug({ event, data }, 'Emitting event');
    this.emit(event, data);
  }
}

// Event types
export const AppEvents = {
  USER_CREATED: 'user:created',
  TOKEN_CREATED: 'token:created',
  TOKEN_REVOKED: 'token:revoked',
  CREDITS_DEDUCTED: 'credits:deducted',
  CREDITS_REFUNDED: 'credits:refunded',
  API_REQUEST: 'api:request',
  RATE_LIMIT_EXCEEDED: 'rate-limit:exceeded',
} as const;
```

### Connecting Events to Jobs

```typescript
// apps/api/src/events/listeners.ts
import { Queue } from 'bullmq';
import { AppEventEmitter, AppEvents } from './emitter';
import { QueueNames } from '../jobs/queues';
import type { Logger } from 'pino';

export function registerEventListeners(
  emitter: AppEventEmitter,
  queues: Map<string, Queue>,
  logger: Logger
): void {
  // Usage logging
  emitter.on(AppEvents.API_REQUEST, async (data) => {
    const usageQueue = queues.get(QueueNames.USAGE_LOG);
    await usageQueue?.add('log-usage', data, {
      removeOnComplete: true,
    });
  });

  // Send email on low credits
  emitter.on(AppEvents.CREDITS_DEDUCTED, async (data) => {
    const user = data.user;
    const threshold = user.plan.monthlyCredits * 0.1;

    if (user.creditsRemaining < threshold) {
      const emailQueue = queues.get(QueueNames.EMAIL);
      await emailQueue?.add('low-credits', {
        to: user.email,
        subject: 'Low Credit Balance',
        templateId: 'low-credits',
        data: {
          userName: user.email,
          creditsRemaining: user.creditsRemaining,
        },
      });
    }
  });

  // Queue refund on upstream failure
  emitter.on(AppEvents.CREDITS_REFUNDED, async (data) => {
    const refundQueue = queues.get(QueueNames.REFUND);
    await refundQueue?.add('process-refund', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  });

  logger.info('Event listeners registered');
}
```

---

## Job Patterns

### Scheduling Jobs

```typescript
// Schedule recurring jobs
import { Queue } from 'bullmq';

const queue = new Queue('maintenance');

// Run every day at midnight
await queue.add(
  'daily-cleanup',
  { type: 'cleanup' },
  {
    repeat: {
      pattern: '0 0 * * *', // Cron expression
    },
  }
);

// Run every hour
await queue.add(
  'token-expiry-check',
  {},
  {
    repeat: {
      every: 3600000, // milliseconds
    },
  }
);
```

### Job Priority

```typescript
// Higher priority = processed first
await queue.add('urgent-email', emailData, {
  priority: 1, // Higher priority
});

await queue.add('newsletter', emailData, {
  priority: 10, // Lower priority
});
```

### Delayed Jobs

```typescript
// Delay job execution
await queue.add('reminder', reminderData, {
  delay: 24 * 60 * 60 * 1000, // 24 hours
});
```

### Job Dependencies

```typescript
// Wait for parent job to complete
const parentJob = await queue.add('parent', data);

await queue.add('child', childData, {
  parent: {
    id: parentJob.id,
    queue: queue.name,
  },
});
```

### Idempotent Jobs

```typescript
// Use jobId to prevent duplicates
await queue.add(
  'process-payment',
  paymentData,
  {
    jobId: `payment-${paymentId}`, // Unique ID
    removeOnComplete: false,
  }
);
```

---

## Testing

### Testing Job Processors

```typescript
// usage-logger.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageLogProcessor } from './usage-logger';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

vi.mock('@prisma/client');

describe('UsageLogProcessor', () => {
  let processor: UsageLogProcessor;
  let prisma: PrismaClient;
  let logger: pino.Logger;

  beforeEach(() => {
    prisma = new PrismaClient();
    logger = pino({ level: 'silent' });
    processor = new UsageLogProcessor(prisma, logger);
  });

  it('should create usage log', async () => {
    const job = {
      id: '1',
      data: {
        userId: 1n,
        apiId: 1n,
        tokenId: 1n,
        endpointId: 1n,
        creditsUsed: 10,
        statusCode: 200,
        latencyMs: 50,
        timestamp: new Date(),
      },
    } as any;

    vi.mocked(prisma.usageLog.create).mockResolvedValue({} as any);

    await processor.process(job);

    expect(prisma.usageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1n,
        creditsUsed: 10,
      }),
    });
  });
});
```

### Testing Event Emission

```typescript
// event-emitter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AppEventEmitter, AppEvents } from './emitter';
import pino from 'pino';

describe('AppEventEmitter', () => {
  it('should emit events', () => {
    const logger = pino({ level: 'silent' });
    const emitter = new AppEventEmitter(logger);

    const listener = vi.fn();
    emitter.on(AppEvents.USER_CREATED, listener);

    emitter.emitAsync(AppEvents.USER_CREATED, { userId: 1n });

    expect(listener).toHaveBeenCalledWith({ userId: 1n });
  });
});
```

---

## Best Practices

### Do

- Use queues for async operations (email, webhooks)
- Set appropriate retry strategies
- Log job start/completion/failure
- Use idempotency keys to prevent duplicates
- Clean up completed jobs
- Monitor queue health
- Use priority for urgent jobs
- Handle job failures gracefully
- Test job processors independently
- Use typed job data interfaces

### Don't

- Queue operations requiring immediate feedback
- Forget to handle job failures
- Store large payloads in jobs (use references)
- Use queues for real-time operations
- Ignore failed jobs
- Skip retry logic
- Process jobs synchronously
- Forget to close connections on shutdown

### Queue Patterns Checklist

- [ ] Queues configured with connection pooling
- [ ] Workers have concurrency limits
- [ ] Retry logic with exponential backoff
- [ ] Failed jobs monitored and alerted
- [ ] Completed jobs cleaned up
- [ ] Job processors are idempotent
- [ ] Critical jobs have priority
- [ ] Events logged for debugging
- [ ] Tests cover job processors
- [ ] Graceful shutdown implemented

---

## Graceful Shutdown

```typescript
// apps/api/src/server.ts
import { QueueManager } from './lib/queue-manager';

const queueManager = new QueueManager(app.log);

// Handle shutdown
const gracefulShutdown = async () => {
  app.log.info('Shutting down gracefully');

  // Close server
  await app.close();

  // Close queues and workers
  await queueManager.close();

  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## Related Documentation

- [BullMQ Documentation](https://docs.bullmq.io)
- [SERVICE_PATTERNS.md](./SERVICE_PATTERNS.md)
- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [LOGGING_STANDARDS.md](./LOGGING_STANDARDS.md)
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md)
