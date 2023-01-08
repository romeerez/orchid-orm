import { AdapterOptions, MaybeArray } from 'pqb';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, rollback } from './commands/migrateOrRollback';
import { getMigrationConfigWithDefaults, RakeDbConfig } from './common';
import { generate } from './commands/generate';

export const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig: Partial<RakeDbConfig> = {},
  args: string[] = process.argv.slice(2),
) => {
  const config = getMigrationConfigWithDefaults(partialConfig);

  const command = args[0]?.split(':')[0];

  if (command === 'create') {
    await createDb(options, config);
  } else if (command === 'drop') {
    await dropDb(options);
  } else if (command === 'reset') {
    await resetDb(options, config);
  } else if (command === 'migrate') {
    await migrate(options, config, args.slice(1));
  } else if (command === 'rollback') {
    await rollback(options, config, args.slice(1));
  } else if (command === 'g' || command === 'generate') {
    await generate(config, args.slice(1));
  } else {
    printHelp();
  }
};

const printHelp = () =>
  console.log(
    `Usage: rake-db [command] [arguments]

Commands:
  create                  create databases
  drop                    drop databases
  reset                   drop, create and migrate databases
  g, generate             generate migration file, see below
  migrate                 migrate all pending migrations
  rollback                rollback the last migrated
  no or unknown command   prints this message
  
Generate arguments:
- (required) first argument is migration name
  * create*      template for create table
  * change*      template for change table
  * add*To*      template for add columns
  * remove*From* template for remove columns
  * drop*        template for drop table

- other arguments considered as columns with types and optional methods:
  rake-db g createTable id:serial.primaryKey name:text.nullable
`,
  );
