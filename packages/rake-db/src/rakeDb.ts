import { AdapterOptions, DefaultColumnTypes, DefaultSchemaConfig } from 'pqb';
import {
  ColumnSchemaConfig,
  MaybeArray,
  MaybePromise,
  RecordOptionalString,
  RecordString,
  toArray,
} from 'orchid-core';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { migrate, redo, rollback } from './commands/migrateOrRollback';
import { newMigration } from './commands/newMigration';
import { pullDbStructure } from './generate/pull';
import { RakeDbError } from './errors';
import { ChangeCallback, pushChange } from './migration/change';
import { runRecurrentMigrations } from './commands/recurrent';
import { listMigrationsStatuses } from './commands/listMigrationsStatuses';
import {
  AnyRakeDbConfig,
  InputRakeDbConfig,
  processRakeDbConfig,
  RakeDbConfig,
} from './config';
import { changeIds } from './commands/changeIds';
import { rebase } from './commands/rebase';

/**
 * Type of {@link rakeDb} function
 */
export type RakeDbFn = (<
  SchemaConfig extends ColumnSchemaConfig,
  CT = undefined,
>(
  options: MaybeArray<AdapterOptions>,
  partialConfig: InputRakeDbConfig<SchemaConfig, CT>,
  args?: string[],
) => RakeDbFnReturns<CT>) & {
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

export type RakeDbFnReturns<CT> = RakeDbChangeFn<
  CT extends undefined ? DefaultColumnTypes<DefaultSchemaConfig> : CT
> & {
  promise: Promise<RakeDbResult>;
};

export interface RakeDbResult {
  // database connection options
  options: AdapterOptions[];
  // rake-db config
  config: AnyRakeDbConfig;
  // command and arguments passed to `rakeDb.lazy` or taken from process.argv
  args: string[];
}

/**
 * Type of {@link rakeDb.lazy} function
 */
export type RakeDbLazyFn = <SchemaConfig extends ColumnSchemaConfig, CT>(
  options: MaybeArray<AdapterOptions>,
  partialConfig: InputRakeDbConfig<SchemaConfig, CT>,
) => {
  change: RakeDbChangeFn<CT>;
  run(
    args: string[],
    config?: Partial<RakeDbConfig<SchemaConfig, CT>>,
  ): Promise<RakeDbResult>;
};

/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export type RakeDbChangeFn<CT> = (fn: ChangeCallback<CT>) => ChangeCallback<CT>;

/**
 * Function to configure and run `rakeDb`.
 *
 * @param options - {@link AdapterOptions} or an array of such options to migrate multiple dbs
 * @param config - {@link RakeDbConfig}
 * @param args - optionally provide an array of cli args. Default is `process.argv.slice(2)`.
 */
export const rakeDb: RakeDbFn = ((
  options,
  partialConfig,
  args = process.argv.slice(2),
) => {
  const config = processRakeDbConfig(partialConfig);
  const promise = runCommand(
    options,
    config as unknown as RakeDbConfig<ColumnSchemaConfig>,
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

rakeDb.lazy = ((options, partialConfig) => {
  const config = processRakeDbConfig(partialConfig);

  return {
    change,
    run(args: string[], conf) {
      return runCommand(options, conf ? { ...config, ...conf } : config, args);
    },
  };
}) as RakeDbLazyFn;

function change(fn: ChangeCallback<unknown>) {
  pushChange(fn);
  return fn;
}

export const rakeDbAliases: RecordOptionalString = {
  migrate: 'up',
  rollback: 'down',
  s: 'status',
  rec: 'recurrent',
};

const runCommand = async <SchemaConfig extends ColumnSchemaConfig, CT>(
  opts: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<SchemaConfig, CT>,
  args: string[] = process.argv.slice(2),
): Promise<RakeDbResult> => {
  let arg = args[0]?.split(':')[0];
  if (rakeDbAliases[arg]) {
    args = [...args]; // to not mutate given arguments
    arg = args[0] = rakeDbAliases[arg] as string;
  }

  const options = toArray(opts);

  args.shift();

  const command = rakeDbCommands[arg]?.run ?? config.commands[arg];
  if (command) {
    await command(options, config, args);
  } else if (config.logger) {
    type HelpBlock = [key: string, help: string, helpArguments?: RecordString];

    const commandsHelp: HelpBlock[] = [];

    let max = 0;
    let maxArgs = 0;

    const addedCommands = new Map<RakeDbCommand, HelpBlock>();
    for (let key in rakeDbCommands) {
      const command = rakeDbCommands[key];
      const added = addedCommands.get(command);
      if (added) key = added[0] += `, ${key}`;

      if (key.length > max) max = key.length;

      if (added) continue;

      if (command.helpArguments) {
        maxArgs = Math.max(
          maxArgs,
          ...Object.keys(command.helpArguments).map((key) => key.length + 5),
        );
      }

      const helpBlock: HelpBlock = [key, command.help, command.helpArguments];
      addedCommands.set(command, helpBlock);

      if (command.helpAfter) {
        const i = commandsHelp.findIndex(([key]) => key === command.helpAfter);
        if (i === -1) {
          throw new Error(
            `${command.helpAfter} command is required for ${key} but is not found`,
          );
        }
        commandsHelp.splice(i + 1, 0, helpBlock);
      } else {
        commandsHelp.push(helpBlock);
      }
    }

    config.logger.log(`Usage: rake-db [command] [arguments]

See documentation at:
https://orchid-orm.netlify.app/guide/migration-commands.html

Commands:

${commandsHelp
  .map(([key, help, helpArguments]) => {
    let result = `${key}  ${help.padStart(max - key.length + help.length)}`;

    if (helpArguments) {
      result += `\n  arguments:\n${Object.entries(helpArguments)
        .map(
          ([arg, help]) =>
            `    ${arg} ${`  ${help}`.padStart(
              maxArgs - arg.length - 5 + help.length + 2,
            )}`,
        )
        .join('\n')}`;
    }

    return result;
  })
  .join('\n\n')}
`);
  }

  return {
    options,
    config,
    args,
  };
};

interface RakeDbCommand {
  run(
    options: AdapterOptions[],
    config: AnyRakeDbConfig,
    args: string[],
  ): MaybePromise<unknown>;
  help: string;
  helpArguments?: RecordString;
  helpAfter?: string;
}

interface RakeDbCommands {
  [K: string]: RakeDbCommand;
}

const upCommand: RakeDbCommand = {
  run: (options, config, args) =>
    migrate({}, options, config, args).then(() =>
      runRecurrentMigrations(options, config),
    ),
  help: 'migrate pending migrations',
  helpArguments: {
    'no arguments': 'migrate all pending',
    'a number': 'run a specific number of pending migrations',
    force: 'enforce migrating a pending file in the middle',
  },
};

const downCommand: RakeDbCommand = {
  run: (options, config, args) => rollback({}, options, config, args),
  help: 'rollback migrated migrations',
  helpArguments: {
    'no arguments': 'rollback one last migration',
    'a number': 'rollback a specified number',
    all: 'rollback all migrations',
  },
};

const statusCommand: RakeDbCommand = {
  run: listMigrationsStatuses,
  help: 'list migrations statuses',
  helpArguments: {
    'no arguments': `does not print file paths`,
    'p, path': 'also print file paths',
  },
};

const recurrentCommand: RakeDbCommand = {
  run: runRecurrentMigrations,
  help: 'run recurrent migrations',
};

export const rakeDbCommands: RakeDbCommands = {
  create: {
    run: createDb,
    help: 'create databases',
  },
  drop: {
    run: dropDb,
    help: 'drop databases',
  },
  reset: {
    run: (options, config) =>
      resetDb(options, config).then(() =>
        runRecurrentMigrations(options, config),
      ),
    help: 'drop, create and migrate databases',
  },
  up: upCommand,
  migrate: upCommand,
  down: downCommand,
  rollback: downCommand,
  redo: {
    run: (options, config, args) =>
      redo({}, options, config, args).then(() =>
        runRecurrentMigrations(options, config),
      ),
    help: 'rollback and migrate, run recurrent',
  },
  pull: {
    run: ([options], config) => pullDbStructure(options, config),
    help: 'generate a combined migration for an existing database',
  },
  new: {
    run: (_, config, args) => newMigration(config, args),
    help: 'create new migration file',
  },
  s: statusCommand,
  status: statusCommand,
  rec: recurrentCommand,
  recurrent: recurrentCommand,
  rebase: {
    run: rebase,
    help: 'move local migrations below the new ones from upstream',
  },
  'change-ids': {
    run: changeIds,
    help: 'change migrations ids format',
    helpArguments: {
      serial: 'change ids to 4 digit serial',
      'serial *number*': 'change ids to serial number of custom length',
      timestamp: 'change ids to timestamps',
    },
  },
};
