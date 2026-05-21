# Agent Guidelines

## Test fixtures (`src/test-fixtures.ts`)

Before writing or modifying any test, review `src/test-fixtures.ts` to avoid duplicating test utilities. This file is the single source of truth for reusable test doubles, factories, and helpers.

When writing tests:
- Import existing fixtures instead of writing inline mocks, stubs, or data factories.
- If a test needs a mock, stub, or factory that doesn't exist yet, add it to `src/test-fixtures.ts` rather than defining it inline in the test file.
- Follow the existing naming conventions: `create*` for factory functions, `make*` for plain data builders, `mock*` for fetch/network stubs.
