# Config schema single source of truth

Kogoro's configurable parameters (extensions, templates, concurrency, plugin toggles, etc.) were defined and consumed across multiple files with duplicated defaults and no type safety. We decided to centralize all configurable parameters into a single Valibot schema in `src/config/schema.ts`, with `ConfigManager` acting as the sole persistence layer. Every config key has one definition, one default, and one validation rule — CLI option defaults, handlers, and the TOML file all derive from the schema.

The alternative was keeping the flat `Record<string, string>` store with loose getters, which is simpler and dependency-free. We rejected it because the duplication of config keys and defaults across `config-manager.ts`, `cli/scan/handlers.ts`, `plugin-factory.ts`, and `config-wizard.ts` had already led to bugs (dead keys like `api-delay`, inconsistent exclude patterns, CLI concurrency defaults overriding config defaults). A typed schema with runtime validation catches these at the boundary instead of letting them slip into runtime.

We chose Valibot over Zod because Valibot is tree-shakeable and lighter for a CLI tool distributed as a compiled binary.
