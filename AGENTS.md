# Agent Guidelines

## Test fixtures (`src/fixtures.ts`)

Before writing or modifying any test, review `src/fixtures.ts` to avoid duplicating test utilities. This file is the single source of truth for reusable test doubles, factories, and helpers.

When writing tests:
- Import existing fixtures instead of writing inline mocks, stubs, or data factories.
- If a test needs a mock, stub, or factory that doesn't exist yet, add it to `src/fixtures.ts` rather than defining it inline in the test file.
- Follow the existing naming conventions: `create*` for factory functions, `make*` for plain data builders, `mock*` for fetch/network stubs.

## Test naming and describe structure

All `describe` and `test` names must be descriptive, clear, and consistent. Follow these rules when writing or renaming tests:

### Describe blocks
- Nest `describe` blocks inside the class/module-level describe they belong to. Avoid top-level describes that should be grouped under a parent.
- Do not use dots or parentheticals in describe names (e.g. use `"with disabled plugins"` not `"PluginRegistry.instantiate (with disabled)"`).
- Do not create grab-bag containers like `describe("edge cases")` with inner describes that duplicate sibling describe names. Place edge-case tests inside the function-specific describe they relate to.

### Test names
- Do not repeat the subject from the describe block in test names. A test under `describe("wizard")` should be `"sets primary-db"` not `"wizard sets primary-db"`. A test under `describe("cache CLI commands")` should be `"list returns JSON"` not `"cache list returns JSON"`.
- Avoid vague qualifiers like "correctly", "properly", or "gracefully". Describe the expected observable behavior instead.
- Avoid parenthetical commentary in test names (e.g. `"(manual entry)"`, `"(One Piece-like)"`). If the distinction matters, encode it in the test name itself.
- Avoid implementation details in test names (e.g. reference to internal filenames like `"kogoro.toml is written to disk"`, or internal method names like `"matchBatch"`). Describe the observable outcome instead.
- Test names should be short enough to read at a glance. If a name exceeds ~80 characters, consider whether the test is doing too much.
- Use consistent verb tense: prefer present-tense `"returns"`, `"skips"`, `"downloads"` over passive or future constructions.
