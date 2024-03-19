import { AdapterOptions, DefaultColumnTypes, DefaultSchemaConfig } from 'pqb';
import { ColumnSchemaConfig, MaybeArray, toArray } from 'orchid-core';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, redo, rollback } from './commands/migrateOrRollback';
import { generate } from './commands/generate';
import { pullDbStructure } from './pull/pull';
import { RakeDbError } from './errors';
import { ChangeCallback, pushChange } from './migration/change';
import { runRecurrentMigrations } from './commands/recurrent';
import { listMigrationsStatuses } from './commands/listMigrationsStatuses';
import { InputRakeDbConfig, processRakeDbConfig, RakeDbConfig } from './config';
import { changeIds } from './commands/changeIds';
import { RakeDbColumnTypes } from './migration/migration';
import { rebase } from './commands/rebase';

/**
 * Type of {@link rakeDb} function
 */
export type RakeDbFn = (<
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes | undefined = undefined,
>(
  options: MaybeArray<AdapterOptions>,
  partialConfig?: InputRakeDbConfig<SchemaConfig, CT>,
  args?: string[],
) => RakeDbChangeFn<
  CT extends undefined ? DefaultColumnTypes<DefaultSchemaConfig> : CT
> & {
  promise: Promise<void>;
}) & {
  /**
   * Unlike the original `rakeDb` that executes immediately,
   * `rakeDb.lazy` returns the `run` function to be later called programmatically.
   *
   * @param options - {@link AdapterOptions} or an array of such options to migrate multiple dbs
   * @param config - {@link RakeDbConfig}
   * @returns `change` is to be used in migrations, `run` takes an array cli args to execute a command
   */
  lazy: RakeDbLazyFn;
};

/**
 * Type of {@link rakeDb.lazy} function
 */
export type RakeDbLazyFn = <
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  options: MaybeArray<AdapterOptions>,
  partialConfig?: InputRakeDbConfig<SchemaConfig, CT>,
) => {
  change: RakeDbChangeFn<CT>;
  run(
    args: string[],
    config?: Partial<RakeDbConfig<SchemaConfig, CT>>,
  ): Promise<void>;
};

/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export type RakeDbChangeFn<CT extends RakeDbColumnTypes> = (
  fn: ChangeCallback<CT>,
) => ChangeCallback<CT>;

/**
 * Function to configure and run `rakeDb`.
 *
 * @param options - {@link AdapterOptions} or an array of such options to migrate multiple dbs
 * @param config - {@link RakeDbConfig}
 * @param args - optionally provide an array of cli args. Default is `process.argv.slice(2)`.
 */
export const rakeDb: RakeDbFn = ((
  options,
  partialConfig = {},
  args = process.argv.slice(2),
) => {
  const config = processRakeDbConfig(partialConfig);
  const promise = runCommand(
    options,
    config as unknown as RakeDbConfig<ColumnSchemaConfig, RakeDbColumnTypes>,
    args,
  ).catch((err) => {
    if (err instanceof RakeDbError) {
      config.logger?.error(err.message);
      process.exit(1);
    }
    throw err;
  });

  return Object.assign(change, {
    promise,
  });
}) as RakeDbFn;

rakeDb.lazy = ((options, partialConfig = {}) => {
  const config = processRakeDbConfig(partialConfig);

  return {
    change,
    run(args: string[], conf) {
      return runCommand(options, conf ? { ...config, ...conf } : config, args);
    },
  };
}) as RakeDbLazyFn;

function change(fn: ChangeCallback<RakeDbColumnTypes>) {
  pushChange(fn);
  return fn;
}

const runCommand = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<SchemaConfig, CT>,
  args: string[] = process.argv.slice(2),
): Promise<void> => {
  const arg = args[0]?.split(':')[0];

  if (arg === 'create') {
    await createDb(options, config);
  } else if (arg === 'drop') {
    await dropDb(options, config);
  } else if (arg === 'reset') {
    await resetDb(options, config);
  } else if (arg === 'up' || arg === 'migrate') {
    await migrate({}, options, config, args.slice(1));
  } else if (arg === 'down' || arg === 'rollback') {
    await rollback({}, options, config, args.slice(1));
  } else if (arg === 'redo') {
    await redo({}, options, config, args.slice(1));
  } else if (arg === 'new') {
    await generate(config, args.slice(1));
  } else if (arg === 'pull') {
    await pullDbStructure(toArray(options)[0], config);
  } else if (arg === 'status' || arg === 's') {
    await listMigrationsStatuses(toArray(options), config, args.slice(1));
  } else if (arg === 'rebase') {
    await rebase(toArray(options), config);
  } else if (arg === 'change-ids') {
    await changeIds(toArray(options), config, args.slice(1));
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
};

const help = `Usage: rake-db [command] [arguments]

See documentation at:
https://orchid-orm.netlify.app/guide/migration-commands.html

Commands:
  create                  create databases
  drop                    drop databases
  reset                   drop, create and migrate databases
  pull                    generate a combined migration for an existing database
  new                     create new migration file, see below
  up                      migrate pending migrations
  migrate                 migrate pending migrations, also run recurrent
  up|migrate force        resolve the case of a non-migrated file in the middle
  rollback or down        rollback the last migrated
  redo                    rollback and migrate, run recurrent
  status or s             list migrations statuses
  status path or s p      list migrations statuses and paths to files
  rec or recurrent        run recurrent migrations
  rebase                  move local migrations below the new ones from upstream
  change-ids serial       change migrations ids to 4 digit serial
  change-ids serial 42    change migrations ids to custom digits serial
  change-ids timestamp    change migrations ids to timestamps
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
