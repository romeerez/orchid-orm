import { AdapterOptions, MaybeArray, toArray } from 'pqb';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, rollback } from './commands/migrateOrRollback';
import { processRakeDbConfig, RakeDbConfig } from './common';
import { generate } from './commands/generate';
import { pullDbStructure } from './pull/pull';
import { RakeDbError } from './errors';

export const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig: Partial<RakeDbConfig> = {},
  args: string[] = process.argv.slice(2),
) => {
  const config = processRakeDbConfig(partialConfig);

  const command = args[0]?.split(':')[0];

  try {
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
    } else if (command === 'pull') {
      await pullDbStructure(toArray(options)[0], config);
    } else if (config.commands[command]) {
      await config.commands[command](toArray(options), config, args.slice(1));
    } else {
      printHelp();
    }
  } catch (err) {
    if (err instanceof RakeDbError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
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
  migrate                 migrate pending migrations
  rollback                rollback the last migrated
  no or unknown command   prints this message
  
Migrate arguments:
  no arguments            run all pending migrations
  number                  run specific number of pending migrations

Rollback arguments:
  no arguments            rollback one last applied migration
  number                  rollback specific number of applied migrations
  all                     rollback all applied migrations

Migrate and rollback common arguments:
  --code                  run code updater, overrides \`useCodeUpdater\` option
  --code false            do not run code updater
  
Generate arguments:
- (required) first argument is migration name
  * create*               template for create table
  * change*               template for change table
  * add*To*               template for add columns
  * remove*From*          template for remove columns
  * drop*                 template for drop table

- other arguments considered as columns with types and optional methods:
  rake-db g createTable id:serial.primaryKey name:text.nullable
`,
  );
