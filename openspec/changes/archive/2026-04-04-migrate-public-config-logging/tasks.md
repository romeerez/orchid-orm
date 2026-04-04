## 1. Type Definition

- [x] 1.1 Create `PublicRakeDbConfig` type in `packages/rake-db/src/config.ts`
  - Extend `RakeDbConfig` with `QueryLogOptions`
  - Add JSDoc comment explaining this is for programmatic API use
- [x] 1.2 Export `PublicRakeDbConfig` from `packages/rake-db/src/index.ts`

## 2. Config Processing Function

- [x] 2.1 Create `processPublicRakeDbConfig()` function in `packages/rake-db/src/config.ts`
  - Handle `log: true` → set `logger: console`
  - Handle `log: false` → remove `logger` non-mutatively (using destructuring)
  - Handle `log: undefined` → preserve existing `logger`
  - Return new `RakeDbConfig` object
- [x] 2.2 Export `processPublicRakeDbConfig` for internal use

## 3. Update Migrate Function

- [x] 3.1 Update `MigrateFn` interface in `packages/rake-db/src/commands/migrate-or-rollback.ts`
  - Change 2nd parameter from `RakeDbConfig` to `PublicRakeDbConfig`
- [x] 3.2 Update `migrate()` function to call `processPublicRakeDbConfig()`
  - Call processing function at the start to convert config
  - Use resulting `RakeDbConfig` for internal operations

## 4. Update Rollback Function

- [x] 4.1 Update `rollback()` function signature
  - Change 2nd parameter from `RakeDbConfig` to `PublicRakeDbConfig`
- [x] 4.2 Update `rollback()` function to call `processPublicRakeDbConfig()`
  - Call processing function at the start to convert config
  - Use resulting `RakeDbConfig` for internal operations

## 5. Update Redo Function

- [x] 5.1 Update `redo()` function signature
  - Change 2nd parameter from `RakeDbConfig` to `PublicRakeDbConfig`
- [x] 5.2 Update `redo()` function to call `processPublicRakeDbConfig()`
  - Call processing function at the start to convert config
  - Use resulting `RakeDbConfig` for internal operations

## 6. Testing

- [x] 6.1 Add unit tests for `processPublicRakeDbConfig()`
  - Test `log: true` sets `logger` to `console`
  - Test `log: false` removes `logger` non-mutatively
  - Test `log: undefined` preserves custom `logger`
  - Test original config is not mutated
- [ ] 6.2 Add integration tests for `migrate()` with `log` option
  - Test migration runs with `log: true`
  - Test migration runs silently with `log: false`
  - Test migration preserves custom logger when `log` is undefined
- [x] 6.3 Run existing tests to ensure backward compatibility
  - All existing tests should pass without modification

## 7. Documentation

- [x] 7.1 Update JSDoc for `migrate()`, `rollback()`, `redo()` functions
  - Document that `log?: boolean` is now supported
  - Document that `logger` option is still available for custom loggers
- [x] 7.2 Export `PublicRakeDbConfig` type in package exports
  - Ensure type is available for TypeScript users
