import { AdapterOptions, DefaultColumnTypes } from 'pqb';
import { ColumnTypesBase, MaybeArray, toArray } from 'orchid-core';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, redo, rollback } from './commands/migrateOrRollback';
import { InputRakeDbConfig, processRakeDbConfig, RakeDbConfig } from './common';
import { generate } from './commands/generate';
import { pullDbStructure } from './pull/pull';
import { RakeDbError } from './errors';
import { ChangeCallback, pushChange } from './migration/change';
import { runRecurrentMigrations } from './commands/recurrent';

export const rakeDb = <CT extends ColumnTypesBase = DefaultColumnTypes>(
  options: MaybeArray<AdapterOptions>,
  partialConfig: InputRakeDbConfig<CT> = {},
  args: string[] = process.argv.slice(2),
): ((fn: ChangeCallback<CT>) => void) & { promise: Promise<void> } => {
  const config = processRakeDbConfig(partialConfig);
  const promise = runCommand(options, config, args);

  return Object.assign(
    (fn: ChangeCallback<CT>) => {
      pushChange(fn as unknown as ChangeCallback);
    },
    {
      promise,
    },
  );
};

const runCommand = async <CT extends ColumnTypesBase = DefaultColumnTypes>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = process.argv.slice(2),
): Promise<void> => {
  const arg = args[0]?.split(':')[0];

  try {
    if (arg === 'create') {
      await createDb(options, config);
    } else if (arg === 'drop') {
      await dropDb(options, config);
    } else if (arg === 'reset') {
      await resetDb(options, config);
    } else if (arg === 'up' || arg === 'migrate') {
      await migrate(options, config, args.slice(1));
    } else if (arg === 'down' || arg === 'rollback') {
      await rollback(options, config, args.slice(1));
    } else if (arg === 'redo') {
      await redo(options, config, args.slice(1));
    } else if (arg === 'new') {
      await generate(config, args.slice(1));
    } else if (arg === 'pull') {
      await pullDbStructure(toArray(options)[0], config);
    } else if (config.commands[arg]) {
      await config.commands[arg](toArray(options), config, args.slice(1));
    } else if (arg !== 'rec' && arg !== 'recurrent') {
      config.logger?.log(help);
    }

    if (
      arg === 'migrate' ||
      arg === 'rec' ||
      arg === 'recurrent' ||
      arg === 'redo'
    ) {
      await runRecurrentMigrations(options, config);
    }
  } catch (err) {
    if (err instanceof RakeDbError) {
      config.logger?.error(err.message);
      process.exit(1);
    }
    throw err;
  }
};

const help = `Usage: rake-db [command] [arguments]

See documentation at:
https://orchid-orm.netlify.app/guide/migration-commands.html

Commands:
  create                  create databases
  drop                    drop databases
  reset                   drop, create and migrate databases
  new                     create new migration file, see below
  migrate                 migrate pending migrations, run recurrent
  up                      migrate pending migrations, don't run recurrent
  rollback or down        rollback the last migrated
  redo                    rollback and migrate, run recurrent
  rec or recurrent        run recurrent migrations
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
`;
