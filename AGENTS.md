# Agent Coding Guidelines

This file provides instructions for agents working in this repository.

## Project Overview

- **Type**: TypeScript Node.js project with Hono framework
- **Package Manager**: pnpm (v10.33.0+)
- **Node Version**: 20.0.0+
- **Architecture**: Clean architecture with layers: api, application, core, infrastructure, shared

## Commands

### Development

```bash
pnpm dev          # Start dev server with hot reload (tsx watch)
pnpm start        # Run built production server
```

### Build & Type Check

```bash
pnpm build        # Compile TypeScript to dist/
pnpm check        # Run lint + format check + build
```

### Linting & Formatting

```bash
pnpm lint         # Run oxlint
pnpm lint:fix     # Run oxlint with auto-fix
pnpm format       # Run oxfmt to format code
pnpm format:check # Check formatting without modifying
```

### Testing

```bash
pnpm test              # Run all tests (vitest)
pnpm test:ui           # Run tests with UI (vitest --ui)
pnpm test path/to/file # Run single test file
pnpm test -- --grep    # Run tests matching pattern
```

### Pre-commit

```bash
pnpm prepare           # Install husky hooks (runs automatically on pnpm install)
```

## Code Style

### Formatting (oxfmt)

- Single quotes, trailing commas (es5)
- 2 spaces indent, 100 char line width
- Semicolons required
- Arrow functions: always use parentheses

### Linting Rules (oxlint)

- **Errors**: correctness, unused-vars, no-undef, prefer-const, no-var, eqeqeq, curly (all)
- **Warnings**: suspicious, perf, style, restriction
- **Disabled**: no-console (console.log allowed)

### TypeScript

- `strict: true` enabled
- Use `verbatimModuleSyntax` - use `import type` for types only
- All paths use aliases: `@/`, `@/core`, `@/infrastructure`, `@/application`, `@/api`, `@/shared`

### Naming Conventions

- **Files**: kebab-case (e.g., `my-service.ts`)
- **Classes/Interfaces/Types**: PascalCase
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Tests**: `*.test.ts` pattern, descriptive names

### Import Order

1. External imports (node_modules)
2. Alias imports (@/...)
3. Relative imports (./ or ../)
4. Group by type: types, functions, classes

```typescript
// Example import order
import type { SomeType } from "./types";
import { someFunction } from "../utils";
import { Something } from "@/core/service";
import { ExternalLib } from "external-package";
```

### Error Handling

- Use try/catch for async operations
- Return proper error responses in API handlers
- Use custom error classes for domain errors
- Never expose internal error details to clients

### API Routes (Hono)

- Use Hono's built-in routing
- Return appropriate HTTP status codes
- Validate request bodies with Zod
- Use middleware for auth, logging, error handling

### Testing

- Tests live in `tests/` directory
- Structure mirrors `src/` (unit, integration, e2e)
- Use vitest with Node environment
- Use `describe`, `it`, `expect` (vitest globals)
- Mock external dependencies

### Project Structure

```
src/
  api/         # HTTP handlers, routes, middleware
  application/ # Use cases, services orchestration
  core/        # Business logic, entities, value objects
  infrastructure/ # External integrations (DB, APIs)
  shared/      # Utilities, helpers, types
  types/       # TypeScript type definitions
tests/
  unit/        # Unit tests (mirrors src/ structure)
  integration/ # Integration tests
  e2e/         # End-to-end tests
```

### Environment Variables

- Use `.env` for local development
- Copy `.env.example` for new variables
- Never commit secrets to version control
- Use `dotenv` for loading

### Best Practices

- Keep functions small and focused
- Use dependency injection
- Write self-documenting code
- Add type annotations to function parameters and returns
- Prefer immutable patterns (const, spread operator)
- Use early returns to reduce nesting
- Extract complex conditions to named variables

## Cursor/Copilot Rules

- No custom Cursor rules found (`.cursor/rules/`)
- No custom Copilot instructions found (`.github/copilot-instructions.md`)

## Common Workflows

### Running a Single Test

```bash
# By file path
pnpm test tests/unit/api/session.test.ts

# By pattern with grep
pnpm test -- --grep "session"
```

### Debugging Tests

```bash
pnpm test:ui  # Opens vitest UI for interactive testing
```

### Checking Code Before Commit

```bash
pnpm check    # Runs lint + format check + build
```
