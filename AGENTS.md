# Repository Guidelines

## Project Overview

Orchid ORM is a pnpm monorepo of PostgreSQL libraries. PostgreSQL is the only supported database.

| Package                 | Purpose                                                                  | Depends on       |
| ----------------------- | ------------------------------------------------------------------------ | ---------------- |
| `pqb`                   | Core query builder and column abstractions                               | —                |
| `orm`                   | User-facing tables, relations, repositories, and migration generation    | `pqb`, `rake-db` |
| `rake-db`               | Migration management, database operations, introspection, and generation | `pqb`            |
| `create-orm`            | New-project scaffolding                                                  | —                |
| `schemaConfigs/zod`     | Optional Zod schemas for ORM columns                                     | `pqb`            |
| `schemaConfigs/valibot` | Optional Valibot schemas for ORM columns                                 | `pqb`            |
| `test-factory`          | Typed data factories                                                     | `pqb`, `orm`     |
| `test-utils`            | Internal shared testing utilities                                        | —                |

Agents MUST maintain this `AGENTS.md` when repository structure, commands, conventions, or workflows change and the guidance would otherwise become stale.

## Nested `AGENTS.md` Maintenance

After any code change, maintain the nested `AGENTS.md` for every package or cohesive feature folder touched by the change. Create one when the applicable package or feature folder has none.

Nested files are a progressively more focused layer of guidance: they add only durable knowledge specific to their subtree and never repeat parent guidance. Record the feature's intent, invariants and boundaries to preserve, externally meaningful constraints, and durable decisions with their rationale when that rationale prevents a plausible but harmful change.

Also record feature-specific test knowledge: the regressions most likely to occur, the viable way to exercise them, and test patterns that prove the feature's important behavior. Keep this focused on subtree-specific risks and evidence, not generic test commands or parent-level testing rules.

Do not record implementation mechanics, file-by-file or symbol-by-symbol descriptions, temporary task context, current bugs, or details already evident from the code, tests, or parent `AGENTS.md`. Move such material to code comments or normal documentation when it must be retained. Remove entries that no longer describe a durable constraint.

## Project Intent

Public APIs must be fully type-safe. For non-trivial type mappings, add `assertType` coverage for the intended API and `@ts-expect-error` coverage for rejected inputs. Internal typing may be relaxed when it keeps implementation simpler without weakening the public contract.

Tests protect public API and observable behavior, not implementation details. Code should optimize first for simplicity, clarity, and conciseness. Organize modules and functions by responsibility; after substantial generation or editing, remove duplication and split code that mixes responsibilities.

### `pqb`

- Flexible and composable: cover PostgreSQL features without forcing SQL-shaped APIs.
- Explicit and intuitive: prefer simplicity and usability over resemblance to SQL syntax.
- Column abstractions customize parsing, encoding, validation, and per-table data behavior.

### `orm`

- Defines and configures tables, views, and relations over `pqb`.
- Integrates relations into the same query-builder interface.
- Delegates non-relation query behavior to `pqb`.
- Exposes configurable database/ORM constructors and all `pqb` table facilities, including scopes and soft-delete.
- Generates migrations from differences between database structure and user definitions.

### `rake-db`

- Offers CLI and programmatic database-management APIs.
- Runs TypeScript DSL migrations and records applied migrations in a database table.
- Introspects PostgreSQL, represents structures as AST nodes, and generates migration code from structural differences.

Schema config packages remain optional validation integrations. `test-factory` remains an optional testing library driven by ORM/query shapes.

## Architecture & Data Flow

Dependency direction is `pqb` → `orm` / `rake-db` / schema configs / `test-factory`; do not introduce reverse dependencies.

- `packages/pqb/src/query/db.ts` assembles adapter-backed `Db` query/table objects, columns, selections, scopes, soft-delete, hooks, and computed columns.
- `packages/orm/src/orm-instance/orm-instance.ts` materializes table and view declarations into `Db` queries, then attaches metadata, relations, and initialization. `packages/orm/src/relations/relations.ts` resolves relations; through/source relations wait for their dependencies.
- `packages/rake-db/src/config/`, `commands/`, `migration/`, and `generate/` separate configuration, CLI operations, migration execution, and database structure ⇄ AST ⇄ generated migration code.
- Schema config packages implement `pqb`'s `ColumnSchemaConfig` contract rather than duplicating column behavior.

Consumer-facing APIs use documented package-root exports. First-party packages that need implementation-level `pqb` functionality import `pqb/internal`, never deep source paths. `packages/pqb/src/public.ts` defines the narrow consumer facade; `packages/pqb/src/internal.ts` defines the changeable first-party facade. Update export facades deliberately.

## Key Directories

| Path                                        | Purpose                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/pqb/src/`                         | Query builder, columns, adapters, and SQL construction                      |
| `packages/orm/src/`                         | Tables, relations, ORM creation, repositories, and ORM migration generation |
| `packages/rake-db/src/`                     | Migration CLI/API, database operations, introspection, and generators       |
| `packages/schemaConfigs/{zod,valibot}/src/` | Validation adapters                                                         |
| `packages/test-utils/src/`                  | Shared database, SQL, adapter, and type-test helpers                        |
| `packages/test-factory/src/`                | Typed fake-data factories                                                   |
| `packages/create-orm/src/`                  | Scaffolder CLI and serial initialization steps                              |
| `docs/src/guide/`                           | Authored VitePress documentation                                            |
| `scripts/`                                  | Verification, build, coverage, and assistant-sync tooling                   |
| `.changeset/`                               | Pending package release metadata                                            |

## Development Commands

Use the root package aliases rather than spelling out `pnpm --filter`:

| Area                             | Command prefix      |
| -------------------------------- | ------------------- |
| `packages/pqb`                   | `pnpm pqb`          |
| `packages/orm`                   | `pnpm orm`          |
| `packages/rake-db`               | `pnpm rake-db`      |
| `packages/create-orm`            | `pnpm create-orm`   |
| `packages/schemaConfigs/zod`     | `pnpm zod`          |
| `packages/schemaConfigs/valibot` | `pnpm valibot`      |
| `packages/test-factory`          | `pnpm test-factory` |
| `packages/test-utils`            | `pnpm test-utils`   |

Paths passed after `check` are relative to the selected package. Run a focused non-watch test as `pnpm <package-alias> check <path/to/file.test.ts>`, for example `pnpm orm check src/relations/chain.test.ts`. Do not use watch-mode `test`/`t` in agent runs.

```sh
pnpm verify                         # required changed-package verification
pnpm types                          # workspace TypeScript checks
pnpm build                          # Turbo/Rolldown package builds
pnpm lint:check && pnpm fmt:check   # non-mutating style checks
pnpm doc                            # VitePress development server
pnpm doc:build                      # build documentation
```

For database-backed work, start PostgreSQL 15+ (for example `docker compose -f docker-compose.pg.yml up -d`), copy `.env.example`, then run `pnpm db create` and `pnpm db migrate`. Set `ADAPTER=postgres-js`, `ADAPTER=node-postgres`, or `ADAPTER=bun` for adapter-sensitive tests.

## Code Conventions & Common Patterns

- Use kebab-case for files and directories. Colocate tests as `*.test.ts`, including qualified names such as `get.query.test.ts`.
- Prefer `interface` over `type` when practical.
- For type-only error paths that throw, use `expect(() => expression).toThrow()` rather than unreachable `false &&` or `if (false)` blocks.
- Do not use IIFEs. Save nested ternary results to a named constant instead of nesting them in another expression.
- Prefer `if (!value)` over explicit null/undefined comparisons only when no other falsey value is valid. Comment genuine edge cases.
- Group parameters into an object for user-facing functions; prefer positional parameters for small local helpers.
- Minimal casts that expand user-provided generic types are acceptable. Otherwise treat `as` as a potential design problem rather than hiding a mismatch.
- Add query and column semantics in `pqb`; attach ORM-only behavior during table/ORM assembly. Keep create-orm initialization in focused `lib/init/*` steps registered in deterministic serial order.
- Oxfmt uses single quotes and an 80-column width. Oxlint permits intentionally unused names only when `_`-prefixed.

## Important Files

- `package.json` — canonical commands and package aliases.
- `pnpm-workspace.yaml`, `turbo.json` — workspace membership and task orchestration.
- `tsconfig.json` — strict compiler settings and source-path mappings.
- `rolldown.utils.mjs`, `scripts/build.mjs` — CJS/ESM/declaration builds and generated declaration cleanup.
- `scripts/verify.ts` — changed-package test/type verification.
- `jest.config.mjs`, `jest-setup.ts`, `jest-load-env.cjs` — shared test configuration and environment.
- `packages/pqb/src/public.ts`, `packages/pqb/src/internal.ts` — public and first-party `pqb` boundaries.
- `docs/src/.vitepress/config.mts` — documentation navigation.
- `.omp/RULES.md` — short, sticky requirements that must remain active throughout long agent sessions.

## Runtime/Tooling Preferences

- Node 24 (`.nvmrc`) and pnpm 10.32.1 are required. Bun is a supported adapter/test runtime, not the package manager.
- Keep dependency versions exact (`.npmrc`). Workspace packages are `packages/*` and `packages/schemaConfigs/*`; e2e and benchmarks are excluded.
- Turbo orchestrates package tasks. Rolldown emits CommonJS `.js`, ESM `.mjs`, declarations, and source maps. Do not edit build output or generated `.d.ts` files under source directories.
- Author docs in `docs/src/guide/`, not `docs/src/.vitepress/dist/`. Preserve `llm-include`, `llm-exclude`, and `prettier-ignore` directives. A `has JSDoc` marker requires the corresponding source JSDoc update; update `docs/src/.vitepress/config.mts` when guide navigation changes.
- Feature and bug-fix changes to published packages require `pnpm changeset` with a concise description and issue reference such as `(#123)`.

## Testing & QA

All packages use Jest. Tests are colocated under `packages/**/src/**/*.test.ts` and may combine runtime results, exact generated SQL, and compile-time contracts.

- Reuse `packages/test-utils/src/test-utils.ts`: `useTestDatabase()` provides rollback isolation, `expectSql()` checks normalized SQL, and `assertType` verifies type mappings.
- Reuse `packages/test-utils/src/test-db.ts` and `packages/orm/src/test-utils/orm.test-utils.ts` instead of duplicating common database fixtures or ORM helpers.
- Database tests use `PG_URL`, `PG_GENERATE_URL`, and `ADAPTER`; `postgres-js` is the default adapter.
- Start with the affected non-watch package check, then run `pnpm verify` after changes in published packages or `test-utils`. Adapter changes require the postgres-js, node-postgres, and Bun matrix.
- CI additionally runs coverage, lint, formatting, workspace types, build, and built-package type checks.
- Tests must defend observable public SQL, runtime, migration, or type behavior. Avoid assertions tied only to internal implementation.
