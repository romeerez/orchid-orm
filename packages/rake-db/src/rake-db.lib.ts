import {
  createDatabase,
  createSchema,
  createTable,
  dropDatabase,
  dropSchema,
  dropTable,
} from './commands/create-or-drop';
import { getMigrationsSchemaAndTable } from './migration/migration.utils';
import { createMigrationsSchemaAndTable } from './migration/manage-migrated-versions';
import { runRecurrentMigrations } from './commands/recurrent';
import { migrate, redo, rollback } from './commands/migrate-or-rollback';

export interface InitRakeDb {
  (): Migrator;
}

export interface Migrator {
  createDatabase: typeof createDatabase;
  dropDatabase: typeof dropDatabase;
  createSchema: typeof createSchema;
  dropSchema: typeof dropSchema;
  createTable: typeof createTable;
  dropTable: typeof dropTable;
  createMigrationsSchemaAndTable: typeof createMigrationsSchemaAndTable;
  migrate: typeof migrate;
  rollback: typeof rollback;
  redo: typeof redo;
  runRecurrentMigrations: typeof runRecurrentMigrations;
}

export const rakeDb: InitRakeDb = () => {
  return {
    createDatabase,
    dropDatabase,
    createSchema,
    dropSchema,
    getMigrationsSchemaAndTable,
    createTable,
    dropTable,
    createMigrationsSchemaAndTable: createMigrationsSchemaAndTable,
    migrate,
    rollback,
    redo,
    runRecurrentMigrations,
  };
};
