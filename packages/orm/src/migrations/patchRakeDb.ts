import { rakeDbCommands } from 'rake-db';
import { generate } from './generate/generate';
import { pull } from './pull/pull';
import { ColumnSchemaConfig } from 'pqb';

rakeDbCommands.g = rakeDbCommands.generate = {
  run: generate,
  help: 'gen migration from OrchidORM tables',
  helpArguments: {
    'no arguments': '"generated" is a default file name',
    'migration-name': 'set migration file name',
    up: 'auto-apply migration',
    'migration-name up': 'with a custom name and apply it',
  },
  helpAfter: 'reset',
};

rakeDbCommands.pull.run = pull;
rakeDbCommands.pull.help =
  'generate ORM tables and a migration for an existing database';

declare module 'rake-db' {
  export interface RakeDbConfig {
    dbPath?: string;
    dbExportedAs?: string;
    generateTableTo?(tableName: string): string;
  }

  export interface RakeDbCliConfigInputBase<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    SchemaConfig extends ColumnSchemaConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    CT,
  > {
    dbPath?: string;
    dbExportedAs?: string;
    generateTableTo?(tableName: string): string;
  }
}
