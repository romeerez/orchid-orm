## Why

https://github.com/romeerez/orchid-orm/issues/671

The `migrate()`, `rollback()`, and `redo()` functions were recently exposed as public APIs but they lack proper logging configuration handling. Currently:

- The shared `RakeDbConfig` has a `log` option in `migrationConfigDefaults`
- Internally, nothing checks the `log` boolean - everything uses an optional `logger`
- `migrate()` ignores `log` and requires `logger` to be passed explicitly
- Users must manually set up logging when calling these functions programmatically

This creates friction when using programmatic migrations, especially in multi-tenant scenarios where logging configuration should be simple and consistent with the ORM's `log: true` pattern.

## What Changes

1. Create a new `PublicRakeDbConfig` type that extends `RakeDbConfig` with `QueryLogOptions` (adding `log?: boolean`)

2. Update `migrate()`, `rollback()`, and `redo()` to accept `PublicRakeDbConfig` as their 2nd argument instead of `RakeDbConfig`

3. Add an internal function to process `PublicRakeDbConfig` into the existing `RakeDbConfig`:
   - If `log` is `undefined`: leave `logger` as-is
   - If `log` is `false`: set `logger` to `undefined`
   - If `log` is `true`: set `logger` to `console`

4. After processing, the resulting `RakeDbConfig` is used internally as before

## Capabilities

### New Capabilities
- `migrate-public-config`: Enable `log: true` option in public migration functions (`migrate`, `rollback`, `redo`)

### Modified Capabilities
<!-- None - this is purely additive API enhancement -->

## Impact

**Affected packages:**
- `rake-db`: Main changes in `config.ts`, `migrate-or-rollback.ts`

**API changes:**
- `migrate(db, config)` - `config` now accepts `log?: boolean`
- `rollback(db, config)` - `config` now accepts `log?: boolean`  
- `redo(db, config)` - `config` now accepts `log?: boolean`

**Breaking changes:** None - this is purely additive

**Internal changes:**
- New type: `PublicRakeDbConfig extends RakeDbConfig, QueryLogOptions`
- New function: `processPublicConfig(config: PublicRakeDbConfig): RakeDbConfig`
