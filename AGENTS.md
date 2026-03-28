---
priority: critical
alwaysApply: true
---

# orchid-orm monorepo

Packages are libraries for working with Postgres.

## Workspace Architecture

Packages are located in `packages/`:

| Package | Description | Dependencies |
|---------|-------------|--------------|
| `docs` | docs are in docs/src/guide, powered by VitePress (https://vitepress.dev/llms.txt) | None |
| `pqb` (Core) | Query Builder and Column Abstractions | None |
| `orm` | User-facing ORM with Relations and Migration Generation | pqb, rake-db |
| `rake-db` | Migrations management and generation | pqb |
| `create-orm` | Bootstrapping tool for new projects | None |
| `schema-configs` | Zod and Valibot integration packages for validation | pqb |
| `test-factory` | Data factories for testing | pqb, orm |
| `test-utils` | Internal testing utilities | None |

## Project Intent

### All Packages
- **Type safety**: Public APIs must be fully type-safe
- **Type System Performance**: Types optimized to minimize TypeScript instantiation count
- **Testing**: Focus on public API and behavior, not internal implementation

### pqb (Query Builder)
- Supports **only Postgres**
- **Flexibility**: Composable, feature-rich, covers extensive Postgres features
- **Explicitness**: Intuitive API design
- **Priorities**: Simplicity and intuitiveness over SQL resemblance
- **Column abstractions**: Customize per-table data behavior

### orm
- Provides functionality to define and configure tables and their relations
- Enhances pqb with seamless relation capabilities for unified query builder
- Generates migrations to resolve database/user code deltas
- Exposes configuration interface for database and ORM instances
- Delegates query-related (non-relation) logic to pqb
- Exposed constructors allow configuring all pqb table features (soft-delete, scopes, etc.)

### rake-db
- CLI and programmatic interfaces
- Database management capabilities
- **Migrations**:
  - TypeScript-based with DSL
  - Tracks applied state via database table
- **Migration Generation**:
  - Introspects database
  - Defines AST of db structures (tables, columns)
  - Generates migration code from AST

### schema-configs
- Optional packages for Zod/Valibot validations from ORM tables

### test-factory
- Optional package for generating mock data in tests

## Tests

- All packages use **Jest**
- **Always run tests after changing code when ready**
- Test a single file with: `pnpm --filter <pkg> check --silent path/to/file.test.ts`
- Test all changed files: `pnpm --filter <pkg> check --silent -o`

## Structure and File Naming

- Use **kebab-case** for all file and directory names

## TypeScript Guidelines

- Prefer `interface` over `type` when possible

## Code Guidelines

### Code clarify
- no IIFE 
- nested ternaries should not be inlined in other expressions - save result to a const
- prefer short `if (!x)` over `if (x === null)` or `if (x === undefined)` when no other falsey values are possible
- leave comments for edge-cases

### Function Params
- Prefer grouping parameters into an object for user-facing functions
- Prefer not grouping parameters of local functions

### Type Casting (`as`)
- Use `as` when generic functions require minimal user-provided types that need internal expansion
- Otherwise, avoid `as` — consider if it indicates a design problem; **stop** and ask for help if unsure

### After Generating Code
- Refactor for simplicity, clarity, conciseness
- Extract similar chunks into reusable functions
- Split long-ass functions into manageable pieces by responsibility
