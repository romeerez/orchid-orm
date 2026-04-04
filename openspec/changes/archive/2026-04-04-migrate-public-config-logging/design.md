## Context

The `migrate()`, `rollback()`, and `redo()` functions in `rake-db` were recently exposed as public APIs for programmatic use. These functions currently accept `RakeDbConfig` as their 2nd argument.

The problem: `RakeDbConfig` already extends `QueryLogOptions` (which includes `log?: boolean`), but the internal processing that converts `log` to `logger` only happens in `makeRakeDbConfig()`. When users call `migrate()` directly with a pre-made config, the `log` option is ignored because the config has already been processed.

Users currently must manually set up `logger` when calling these functions programmatically:
```ts
await migrate(db, { ...config, logger: console }) // manual logger setup
```

The desired UX is:
```ts
await migrate(db, { ...config, log: true }) // simple, consistent with ORM
```

## Goals / Non-Goals

**Goals:**
- Enable `log: true` option in `migrate()`, `rollback()`, `redo()` for programmatic use
- Keep API consistent with ORM's `log: true` pattern
- Process `log` into `logger` automatically for these public functions
- Maintain backward compatibility

**Non-Goals:**
- Full config architecture refactoring (out of scope per issue discussion)
- Changing how CLI-based migrations work (they already work via `makeRakeDbConfig`)
- Adding other new config options beyond logging

## Decisions

### 1. PublicRakeDbConfig type location

**Decision:** Define `PublicRakeDbConfig` in `config.ts` and export it from `index.ts`.

**Rationale:** 
- Keep related config types together
- Even though `RakeDbConfig` already extends `QueryLogOptions`, a distinct `PublicRakeDbConfig` type signals this is for programmatic API use
- Can be extended in future if needed

### 2. Processing function approach

**Decision:** Create a small internal function `processPublicRakeDbConfig()` that handles the `log` → `logger` conversion.

**Rationale:**
- `makeRakeDbConfig()` does too much (path resolution, column types, etc.)
- Public functions just need the logging aspect processed
- The `logger` option is still supported for custom loggers
- When `log: false` is passed, `logger` is removed (non-mutatively) from the config
- When `log: true` is passed, `logger` is set to `console`
- When `log` is undefined, existing `logger` is preserved (whether custom or undefined)

```ts
const processPublicRakeDbConfig = (config: PublicRakeDbConfig): RakeDbConfig => {
  const result = { ...config } as RakeDbConfig;
  if (config.log === false) {
    // Non-mutative: create new object without logger
    const { logger: _, ...rest } = result as unknown as QueryLogOptions;
    return { ...rest, __rakeDbConfig: true } as RakeDbConfig;
  } else if (config.log === true) {
    (result as unknown as QueryLogOptions).logger = console;
  }
  // If log is undefined, preserve existing logger (whether custom or undefined)
  return result;
};
```

### 3. Function signature changes

**Decision:** Change `migrate`, `rollback`, `redo` to accept `PublicRakeDbConfig` instead of `RakeDbConfig`.

**Rationale:**
- These are the main public-facing migration functions
- Internally they immediately call `processPublicRakeDbConfig()` before using config
- Type-safe: users can pass `log?: boolean` but internally we work with processed `RakeDbConfig`

### 4. MigrateFn interface update

**Decision:** Update `MigrateFn` interface to use `PublicRakeDbConfig`.

**Rationale:**
- Keeps type consistency across all three functions
- Ensures any future functions using this interface get the same behavior

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking change to `MigrateFn` interface | This is low-risk as the interface shape is identical (`PublicRakeDbConfig` extends `RakeDbConfig`). Only the type name changes, and `RakeDbConfig` is assignable to `PublicRakeDbConfig`. |
| `log: true` doesn't work as expected | Document that `log` only controls the logger setup; actual logging still depends on internal logger usage patterns. |
| Confusion between `RakeDbConfig` and `PublicRakeDbConfig` | Add JSDoc comments explaining when to use each. `PublicRakeDbConfig` is for programmatic API use. |

## Migration Plan

No migration needed - this is purely additive. Existing code continues to work:
- CLI usage via `rakeDb()` → unchanged (uses `makeRakeDbConfig`)
- Existing programmatic usage with `logger` → unchanged (works as before)
- New programmatic usage with `log: true` → now works

## Open Questions

None - the approach follows the maintainer's guidance from issue #671:
> "I think it's better to extend the shared `RakeDbConfig` into a new type and only use it in `migrate` for now as a 2nd parameter"
