import { AdapterOptions, MaybeArray } from 'pqb';
import { createDb, dropDb } from './commands/createOrDrop';
import { migrate, rollback } from './commands/migrateOrRollback';
import {
  getMigrationConfigWithDefaults,
  MigrationConfig,
} from './commands/common';

export const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig: Partial<MigrationConfig> = {},
  args: string[] = process.argv.slice(2),
) => {
  const config = getMigrationConfigWithDefaults(partialConfig);

  const command = args[0].split(':')[0];

  if (command === 'create') {
    await createDb(options, config);
  } else if (command === 'drop') {
    await dropDb(options);
  } else if (command === 'migrate') {
    await migrate(options, config);
  } else if (command === 'rollback') {
    await rollback(options, config);
  } else {
    console.log(`Usage: rake-db [command] [arguments]`);
  }
};
