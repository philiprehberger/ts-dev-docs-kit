# Validation Guide

**Last Updated**: 2026-03-25
**Status**: Active
**Audience**: Developers

This guide covers input validation for the API Marketplace application using Zod schemas.

---

## Table of Contents

1. [Overview](#overview)
2. [Zod Basics](#zod-basics)
3. [Common Validation Patterns](#common-validation-patterns)
4. [Fastify Integration](#fastify-integration)
5. [Custom Validators](#custom-validators)
6. [Error Handling](#error-handling)
7. [Shared Schemas](#shared-schemas)

---

## Overview

All input validation uses **Zod** schemas. Zod provides:

- Type-safe validation with automatic TypeScript inference
- Composable schemas for reuse
- Clear error messages
- Runtime and compile-time type safety
- Works seamlessly with Fastify

### Installation

```bash
# In apps/api
npm install zod
```

---

## Zod Basics

### Basic Types

```typescript
import { z } from 'zod';

// Primitives
const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const bigIntSchema = z.bigint();
const dateSchema = z.date();

// Parse and validate
const result = stringSchema.parse('hello'); // Returns 'hello'
const invalid = stringSchema.parse(123);     // Throws ZodError

// Safe parse (doesn't throw)
const safe = stringSchema.safeParse('hello');
if (safe.success) {
  console.log(safe.data); // 'hello'
} else {
  console.log(safe.error); // ZodError
}
```

### String Validations

```typescript
const schema = z.string()
  .min(3, 'Must be at least 3 characters')
  .max(100, 'Must be at most 100 characters')
  .email('Invalid email address')
  .url('Invalid URL')
  .uuid('Invalid UUID')
  .regex(/^[a-z]+$/, 'Must be lowercase letters only')
  .startsWith('mkp_', 'Must start with mkp_')
  .endsWith('.com', 'Must end with .com')
  .trim()                    // Trim whitespace
  .toLowerCase();            // Convert to lowercase

// Special string types
const emailSchema = z.string().email();
const urlSchema = z.string().url();
const uuidSchema = z.string().uuid();
```

### Number Validations

```typescript
const schema = z.number()
  .min(0, 'Must be non-negative')
  .max(1000, 'Must be at most 1000')
  .int('Must be an integer')
  .positive('Must be positive')
  .negative('Must be negative')
  .nonnegative('Must be non-negative')
  .nonpositive('Must be non-positive')
  .finite('Must be finite')
  .safe('Must be safe integer');

// Coercion (convert strings to numbers)
const coerceSchema = z.coerce.number();
coerceSchema.parse('42'); // Returns 42
```

### Optional and Nullable

```typescript
// Optional (can be undefined)
const optional = z.string().optional();
optional.parse(undefined); // OK

// Nullable (can be null)
const nullable = z.string().nullable();
nullable.parse(null); // OK

// Both
const both = z.string().optional().nullable();
both.parse(null);      // OK
both.parse(undefined); // OK

// Default value
const withDefault = z.string().default('default');
withDefault.parse(undefined); // Returns 'default'
```

---

## Common Validation Patterns

### Object Schemas

```typescript
// User creation schema
const createUserSchema = z.object({
  email: z.string().email(),
  planId: z.bigint().positive(),
  creditsRemaining: z.number().int().min(0).default(0),
  creditResetDay: z.number().int().min(1).max(28),
});

// Infer TypeScript type from schema
type CreateUserInput = z.infer<typeof createUserSchema>;
// {
//   email: string;
//   planId: bigint;
//   creditsRemaining: number;
//   creditResetDay: number;
// }

// Parse
const data = createUserSchema.parse({
  email: 'user@example.com',
  planId: 1n,
  creditResetDay: 15,
});
```

### Partial and Pick

```typescript
const userSchema = z.object({
  id: z.bigint(),
  email: z.string().email(),
  creditsRemaining: z.number(),
  createdAt: z.date(),
});

// Make all fields optional
const partialSchema = userSchema.partial();

// Pick specific fields
const updateSchema = userSchema.pick({
  email: true,
  creditsRemaining: true,
});

// Omit fields
const responseSchema = userSchema.omit({ createdAt: true });

// Make specific fields optional
const schema = userSchema.extend({
  email: z.string().email().optional(),
});
```

### Arrays

```typescript
// Array of strings
const tagsSchema = z.array(z.string())
  .min(1, 'At least one tag required')
  .max(10, 'Maximum 10 tags allowed');

// Array of objects
const itemsSchema = z.array(
  z.object({
    apiId: z.bigint(),
    quantity: z.number().int().positive(),
  })
).nonempty('At least one item required');

// Parse
const items = itemsSchema.parse([
  { apiId: 1n, quantity: 5 },
  { apiId: 2n, quantity: 3 },
]);
```

### Enums

```typescript
// String enum
const statusSchema = z.enum(['ACTIVE', 'DEPRECATED', 'DISABLED']);
type Status = z.infer<typeof statusSchema>; // 'ACTIVE' | 'DEPRECATED' | 'DISABLED'

// With TypeScript enum
enum ApiStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DISABLED = 'disabled',
}

const apiStatusSchema = z.nativeEnum(ApiStatus);
```

### Union Types

```typescript
// String or number
const idSchema = z.union([z.string(), z.number()]);

// Discriminated union
const responseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    data: z.object({ id: z.bigint() }),
  }),
  z.object({
    status: z.literal('error'),
    error: z.string(),
  }),
]);
```

### Refinements and Custom Validation

```typescript
// Simple refinement
const passwordSchema = z.string()
  .min(8)
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one number'
  );

// Context-based refinement
const dateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'], // Error will be associated with endDate field
  }
);

// Async refinement (e.g., database check)
const emailSchema = z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  'Email already registered'
);
```

---

## Fastify Integration

### JSON Schema from Zod

```bash
npm install fastify-type-provider-zod
```

### Setup Type Provider

```typescript
// apps/api/src/server.ts
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

const app = Fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

### Route with Validation

```typescript
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

export async function tokensModule(app: FastifyInstance) {
  // Create token
  app.post(
    '/tokens',
    {
      schema: {
        body: z.object({
          name: z.string().min(1).max(100),
          expiresAt: z.string().datetime().optional(),
          permissions: z.array(z.object({
            apiId: z.coerce.bigint(),
          })).optional(),
        }),
        response: {
          201: z.object({
            token: z.string(),
            tokenPrefix: z.string(),
            id: z.bigint(),
          }),
        },
      },
    },
    async (request, reply) => {
      // request.body is typed and validated!
      const { name, expiresAt, permissions } = request.body;

      const token = await createToken({
        userId: request.user.id,
        name,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      reply.code(201).send({
        token: token.rawToken,
        tokenPrefix: token.tokenPrefix,
        id: token.id,
      });
    }
  );

  // Query parameters
  app.get(
    '/tokens',
    {
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

      return { tokens };
    }
  );

  // URL parameters
  app.delete(
    '/tokens/:id',
    {
      schema: {
        params: z.object({
          id: z.coerce.bigint(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      await revokeToken(id, request.user.id);

      reply.code(204).send();
    }
  );
}
```

### Validation Error Handling

```typescript
// apps/api/src/server.ts
import { ZodError } from 'zod';

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation Error',
      details: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Other errors...
  request.log.error(error);
  reply.code(500).send({ error: 'Internal Server Error' });
});
```

---

## Custom Validators

### Reusable Validators

```typescript
// apps/api/src/lib/validators.ts
import { z } from 'zod';

// BigInt ID validator
export const idSchema = z.coerce.bigint().positive();

// Email validator
export const emailSchema = z.string().email().toLowerCase();

// Token format validator
export const tokenSchema = z.string()
  .regex(/^mkp_live_[a-zA-Z0-9]{32}$/, 'Invalid token format');

// Credit amount validator
export const creditAmountSchema = z.number()
  .int('Credits must be whole numbers')
  .min(0, 'Credits cannot be negative')
  .max(1000000, 'Credit amount too large');

// Date range validator
export function dateRangeSchema(maxDays = 365) {
  return z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }).refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= maxDays;
    },
    `Date range cannot exceed ${maxDays} days`
  );
}

// Pagination validator
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

### Database-Backed Validators

```typescript
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Validate user exists
export const existingUserIdSchema = z.coerce.bigint().refine(
  async (id) => {
    const user = await prisma.user.findUnique({ where: { id } });
    return user !== null;
  },
  'User not found'
);

// Validate unique email
export function uniqueEmailSchema(excludeUserId?: bigint) {
  return z.string().email().refine(
    async (email) => {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) return true;
      if (excludeUserId && user.id === excludeUserId) return true;

      return false;
    },
    'Email already registered'
  );
}

// Validate sufficient credits
export function sufficientCreditsSchema(userId: bigint) {
  return z.number().positive().refine(
    async (amount) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditsRemaining: true },
      });

      return user && user.creditsRemaining >= amount;
    },
    'Insufficient credits'
  );
}
```

---

## Error Handling

### Parsing Errors

```typescript
import { z, ZodError } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

try {
  const data = schema.parse({
    email: 'invalid',
    age: 15,
  });
} catch (error) {
  if (error instanceof ZodError) {
    console.log(error.errors);
    // [
    //   { path: ['email'], message: 'Invalid email', ... },
    //   { path: ['age'], message: 'Number must be greater than or equal to 18', ... }
    // ]
  }
}
```

### Custom Error Messages

```typescript
const schema = z.object({
  email: z.string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
  }).email('Please enter a valid email address'),

  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number',
  }).min(18, 'You must be at least 18 years old'),
});
```

### Formatted Errors

```typescript
import { z } from 'zod';

const result = schema.safeParse(data);

if (!result.success) {
  const formatted = result.error.format();

  console.log(formatted.email?._errors);  // ['Invalid email']
  console.log(formatted.age?._errors);    // ['Number must be >= 18']
}
```

---

## Shared Schemas

### Package Structure

```typescript
// packages/shared/src/validation.ts
import { z } from 'zod';

// Common validators
export const idSchema = z.coerce.bigint().positive();
export const emailSchema = z.string().email();

// User schemas
export const createUserSchema = z.object({
  email: emailSchema,
  planId: idSchema,
  creditsRemaining: z.number().int().min(0),
  creditResetDay: z.number().int().min(1).max(28),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// API schemas
export const apiFilterSchema = z.object({
  categoryId: idSchema.optional(),
  status: z.enum(['ACTIVE', 'DEPRECATED', 'DISABLED']).optional(),
  search: z.string().optional(),
});

export type ApiFilters = z.infer<typeof apiFilterSchema>;
```

### Using Shared Schemas

```typescript
// apps/api/src/modules/users/index.ts
import { createUserSchema, updateUserSchema } from '@api-marketplace/shared';

app.post(
  '/users',
  {
    schema: {
      body: createUserSchema,
    },
  },
  async (request, reply) => {
    // request.body is typed as CreateUserInput
    const user = await createUser(request.body);
    return user;
  }
);
```

---

## Best Practices

### Do

- Use Zod for all input validation
- Define schemas at module level (not inline)
- Use TypeScript type inference from schemas
- Provide clear, user-friendly error messages
- Validate at API boundaries (don't trust any input)
- Use `.transform()` to normalize data
- Share common schemas in `packages/shared`
- Use `.coerce` for query parameters

### Don't

- Use `any` or skip validation
- Validate the same data multiple times
- Put business logic in validators
- Use regex when Zod has built-in validators
- Forget to handle validation errors
- Trust internal code (validate external inputs only)

---

## Related Documentation

- [Zod Documentation](https://zod.dev)
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod)
- [API_STANDARDS.md](./API_STANDARDS.md)
- [ERROR_HANDLING.md](./ERROR_HANDLING.md)
