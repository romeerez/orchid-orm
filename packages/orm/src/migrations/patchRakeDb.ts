import { rakeDbCommands } from 'rake-db';
import { generate } from './generate/generate';
import { pull } from './pull/pull';
import { ColumnSchemaConfig } from 'orchid-core';
import { DefaultColumnTypes, DefaultSchemaConfig } from 'pqb';

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
  export interface RakeDbConfig<
    SchemaConfig extends ColumnSchemaConfig,
    CT = DefaultColumnTypes<DefaultSchemaConfig>,
  > {
    dbPath?: string;
    dbExportedAs?: string;
    generateTableTo?(tableName: string): string;
  }

  export interface InputRakeDbConfig<
    SchemaConfig extends ColumnSchemaConfig,
    CT,
  > {
    dbPath?: string;
    dbExportedAs?: string;
    generateTableTo?(tableName: string): string;
  }
}
