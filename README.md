# @philiprehberger/dev-docs-kit

[![CI](https://github.com/philiprehberger/ts-dev-docs-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/philiprehberger/ts-dev-docs-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@philiprehberger/dev-docs-kit.svg)](https://www.npmjs.com/package/@philiprehberger/dev-docs-kit)
[![Last updated](https://img.shields.io/github/last-commit/philiprehberger/ts-dev-docs-kit)](https://github.com/philiprehberger/ts-dev-docs-kit/commits/main)
Generate comprehensive development documentation for Node.js/TypeScript projects. Never start docs from scratch again.

## Features

- 🚀 **Complete documentation suite** - 17 development guides covering everything from naming conventions to deployment
- 📋 **Plan & issue tracking** - Built-in templates for implementation plans and issue management
- 🎯 **Battle-tested patterns** - Real-world patterns from production projects
- 🔧 **Customizable** - Easy to adapt to your specific stack and needs
- ⚡ **CLI or programmatic** - Use via CLI or integrate into your build process

## Installation

```bash
npm install -g @philiprehberger/dev-docs-kit
```

Or use directly with npx:

```bash
npx @philiprehberger/dev-docs-kit init
```

## Quick Start

### CLI Usage

Initialize documentation in your project:

```bash
cd my-project
npx @philiprehberger/dev-docs-kit init
```

Interactive prompts will guide you through:
- Project name
- Tech stack selection
- What to include (plans, issues, etc.)

### Programmatic Usage

```typescript
import { generateDocs } from '@philiprehberger/dev-docs-kit';

generateDocs({
  projectName: 'my-api',
  stack: 'fastify-prisma',
  outputDir: process.cwd(),
  includePlans: true,
  includeIssues: true,
});
```

## What Gets Generated

### Development Guides (17 files)

Complete guides covering:

**Core Standards**
- Documentation Standards
- Naming Conventions
- Contributing Guidelines

**Development**
- Testing Standards (Vitest)
- Security Best Practices
- Database Patterns (Prisma)
- Validation Guide (Zod)
- Logging Standards (Pino)
- Error Handling (Fastify)
- Configuration (Zod env validation)

**Architecture**
- Service Patterns
- Middleware (Fastify hooks)
- Events & Listeners (BullMQ)

**Operations**
- API Standards (Fastify REST)
- Local Development (Docker Compose)
- Deployment (PM2/Docker)

### Plan Templates

- **PLAN_TEMPLATE.md** - Full template for complex features
- **PLAN_TEMPLATE_SIMPLE.md** - Lightweight template for bug fixes
- **COMPLETION_REPORT_TEMPLATE.md** - Admin-facing summaries

### Directory Structure

```
docs/
├── DOCS_GUIDE.md          # How to maintain docs
├── guides/
│   ├── INDEX.md           # Guide overview
│   ├── API_STANDARDS.md
│   ├── CONFIGURATION.md
│   ├── CONTRIBUTING.md
│   ├── DATABASE_PATTERNS.md
│   ├── DEPLOYMENT.md
│   ├── DOCUMENTATION_STANDARDS.md
│   ├── ERROR_HANDLING.md
│   ├── EVENTS_LISTENERS.md
│   ├── LOCAL_DEVELOPMENT.md
│   ├── LOGGING_STANDARDS.md
│   ├── MIDDLEWARE.md
│   ├── NAMING_CONVENTIONS.md
│   ├── SECURITY.md
│   ├── SERVICE_PATTERNS.md
│   ├── TESTING_STANDARDS.md
│   └── VALIDATION_GUIDE.md
├── plans/
│   ├── templates/         # Plan templates
│   ├── archive/           # Completed plans
│   ├── backlog/           # Future plans
│   └── reports/           # Completion reports
└── issues/
    └── resolved/          # Fixed issues
```

## CLI Commands

### Initialize Documentation

```bash
dev-docs-kit init [options]

Options:
  -n, --name <name>      Project name
  -s, --stack <stack>    Tech stack (fastify-prisma)
  -o, --output <dir>     Output directory (default: current directory)
  --no-plans             Skip plan templates
  --no-issues            Skip issue tracking structure
```

### List Available Stacks

```bash
dev-docs-kit list-stacks
```

## Available Stacks

- **fastify-prisma** - Fastify API with Prisma ORM, PostgreSQL, Redis, BullMQ

More stacks coming soon:
- express-typeorm
- nestjs-typeorm
- fastapi-sqlalchemy

## Why Use This?

### Problem

Starting a new project means:
- ❌ Writing documentation from scratch
- ❌ Inconsistent docs across projects
- ❌ No standardized patterns for common tasks
- ❌ Hours spent on boilerplate guides

### Solution

This package gives you:
- ✅ Production-tested documentation instantly
- ✅ Consistent structure across all projects
- ✅ Real code examples that actually work
- ✅ Built-in plan and issue tracking system

## Customization

After generation, customize the docs to your needs:

1. **Update project-specific details** - The generator replaces `{{projectName}}` and other variables
2. **Remove irrelevant guides** - Not using OAuth? Delete the relevant sections
3. **Add your own guides** - Follow the same structure in `docs/guides/`
4. **Update standards** - Adapt patterns to your team's preferences

## Philosophy

These guides are **opinionated but adaptable**:

- **Opinionated**: Specific tech choices (Fastify, Prisma, Zod, Vitest)
- **Adaptable**: Clear patterns you can translate to other frameworks
- **Practical**: Real code examples, not pseudocode
- **Complete**: Covers the full development lifecycle

## Examples

See the [examples](https://github.com/philiprehberger/ts-dev-docs-kit/tree/main/examples) directory for:
- Generated documentation samples
- Integration examples
- CI/CD pipeline usage

## API Reference

### `generateDocs(options)`

Generate documentation in a directory.

```typescript
interface GenerateOptions {
  projectName: string;        // Project name for variable replacement
  stack: 'fastify-prisma';   // Tech stack
  outputDir: string;          // Where to create docs/ directory
  includePlans?: boolean;     // Include plan templates (default: true)
  includeIssues?: boolean;    // Include issue tracking (default: true)
}
```

### `getAvailableStacks()`

Get list of available tech stacks.

```typescript
function getAvailableStacks(): Stack[]
```

### `replaceVariables(content, variables)`

Replace template variables in content.

```typescript
function replaceVariables(
  content: string,
  variables: TemplateVariables
): string
```

## Contributing

Contributions welcome! To add a new stack:

1. Create `src/templates/{stack-name}/` directory
2. Add guides and templates
3. Update `Stack` type in `src/types.ts`
4. Update `getAvailableStacks()` in `src/templates.ts`
5. Submit a PR

## Support

If you find this project useful:

⭐ [Star the repo](https://github.com/philiprehberger/ts-dev-docs-kit)

🐛 [Report issues](https://github.com/philiprehberger/ts-dev-docs-kit/issues?q=is%3Aissue+is%3Aopen+label%3Abug)

💡 [Suggest features](https://github.com/philiprehberger/ts-dev-docs-kit/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)

❤️ [Sponsor development](https://github.com/sponsors/philiprehberger)

🌐 [All Open Source Projects](https://philiprehberger.com/open-source-packages)

💻 [GitHub Profile](https://github.com/philiprehberger)

🔗 [LinkedIn Profile](https://www.linkedin.com/in/philiprehberger)

## License

[MIT](LICENSE)
