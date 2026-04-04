## migrate-public-config

Enable `log: true` option in public migration functions (`migrate`, `rollback`, `redo`) for programmatic use.

### Requirements

#### R1: PublicRakeDbConfig type

**GIVEN** the need for programmatic migration configuration  
**WHEN** defining the `PublicRakeDbConfig` type  
**THEN** it should extend `RakeDbConfig` with `QueryLogOptions` to allow `log?: boolean`

#### R2: migrate() accepts log option and uses config handling

**GIVEN** a programmatic call to `migrate()`  
**WHEN** passing `log: true` in the config  
**THEN** the config handling function should return a new config with `logger` set to `console` (non-mutatively)

#### R3: rollback() accepts log option and uses config handling

**GIVEN** a programmatic call to `rollback()`  
**WHEN** passing `log: true` in the config  
**THEN** the config handling function should return a new config with `logger` set to `console` (non-mutatively)

#### R4: redo() accepts log option and uses config handling

**GIVEN** a programmatic call to `redo()`  
**WHEN** passing `log: true` in the config  
**THEN** the config handling function should return a new config with `logger` set to `console` (non-mutatively)

#### R5: log: false disables logging (non-mutatively)

**GIVEN** a programmatic call to `migrate()`, `rollback()`, or `redo()` with a custom `logger`  
**WHEN** passing `log: false` in the config  
**THEN** the config handling function should return a new config without the `logger` property

#### R6: Custom logger is preserved when log is undefined (non-mutatively)

**GIVEN** a programmatic call to `migrate()`, `rollback()`, or `redo()` with a custom `logger`  
**WHEN** passing `log: undefined` or omitting `log` in the config  
**THEN** the config handling function should return a new config with the custom `logger` preserved (non-mutatively)

#### R7: Backward compatibility

**GIVEN** existing code that passes `RakeDbConfig` directly to `migrate()`, `rollback()`, or `redo()`  
**WHEN** the code runs after this change  
**THEN** it should continue to work without modification

#### R8: Type export

**GIVEN** the need for external consumers to use the type  
**WHEN** importing from `rake-db`  
**THEN** `PublicRakeDbConfig` should be exported from the package index

#### R9: All public functions use shared config handling

**GIVEN** the three public functions `migrate()`, `rollback()`, and `redo()`  
**WHEN** each function is called with a config  
**THEN** all three should use the same shared config processing function to handle the `log` option
