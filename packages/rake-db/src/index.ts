export { rakeDbWithAdapters, makeChange } from './rake-db';
export type {
  RakeDbChangeFn,
  RakeDbChangeFnWithPromise,
  RakeDbFn,
} from './rake-db';
export {
  getExcludeName,
  getIndexName,
  encodeColumnDefault,
  getConstraintName,
} from './migration/migration.utils';
export { promptSelect } from './prompt';
export { migrate, migrateAndClose } from './commands/migrate-or-rollback';
export type { MigrateFnConfig } from './commands/migrate-or-rollback';
export type { ChangeCallback } from './migration/change';
export { introspectDbSchema } from './generate/db-structure';
export type {
  DbStructure,
  IntrospectedStructure,
} from './generate/db-structure';
export { astToMigration } from './generate/ast-to-migration';
export { getSchemaAndTableFromName, concatSchemaAndName } from './common';
export {
  getDbStructureTableData,
  tableToAst,
  makeStructureToAstCtx,
  structureToAst,
  makeDomainsMap,
  dbColumnToAst,
  getDbTableColumnsChecks,
  instantiateDbColumn,
} from './generate/structure-to-ast';
export type {
  StructureToAstCtx,
  StructureToAstTableData,
} from './generate/structure-to-ast';
export { makeFileVersion, writeMigrationFile } from './commands/new-migration';
export { migrationConfigDefaults, processRakeDbConfig } from './config';
export type {
  AnyRakeDbConfig,
  InputRakeDbConfigBase,
  RakeDbConfig,
  InputRakeDbConfig,
} from './config';
export type { RakeDbAst } from './ast';
export { createMigrationInterface } from './migration/migration';
export type { SilentQueries, DbMigration } from './migration/migration';
export { saveMigratedVersion } from './migration/manage-migrated-versions';
export { migrateFiles, makeMigrateAdapter } from './migration/migrate/migrate';
export { RakeDbError } from './errors';
export { rakeDbCommands } from './commands';
export { runCommand } from './commands';
export { getMigrationsSchemaAndTable } from './migration/migration.utils';
