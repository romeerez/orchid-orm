import {
  AdapterBase,
  ColumnSchemaConfig,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  MaybeArray,
  RecordOptionalString,
  RecordString,
  toArray,
} from 'pqb';
import {
  createDatabaseCommand,
  dropDatabaseCommand,
  resetDatabaseCommand,
} from './database.cli';
import { runRecurrentMigrations } from '../commands/recurrent';
import { migrateCommand, redoCommand, rollbackCommand } from './migrate.cli';
import { pullDbStructure } from '../generate/pull';
import {
  incrementIntermediateCaller,
  makeRakeDbConfig,
  RakeDbCliConfigInput,
  RakeDbCommand,
  RakeDbCommands,
  RakeDbConfig,
} from '../config';
import { newMigration } from '../commands/new-migration';
import { listMigrationsStatuses } from '../commands/list-migrations-statuses';
import { rebase } from '../commands/rebase';
import { changeIds } from '../commands/change-ids';
import { makeChange, RakeDbChangeFn } from '../migration/change';
import { RakeDbError } from '../errors';

const rakeDbAliases: RecordOptionalString = {
  migrate: 'up',
  rollback: 'down',
  s: 'status',
  rec: 'recurrent',
};

export interface RakeDbCliResult<ColumnTypes, Options> {
  change: RakeDbChangeFn<ColumnTypes>;
  run(options: Options, args?: string[]): Promise<void>;
}

export interface RakeDbFn<Options> {
  <
    SchemaConfig extends ColumnSchemaConfig,
    ColumnTypes = DefaultColumnTypes<DefaultSchemaConfig>,
  >(
    config:
      | RakeDbCliConfigInput<SchemaConfig, ColumnTypes>
      | RakeDbConfig<ColumnTypes>,
    args?: string[],
  ): RakeDbCliResult<ColumnTypes, Options>;

  run<
    SchemaConfig extends ColumnSchemaConfig,
    ColumnTypes = DefaultColumnTypes<DefaultSchemaConfig>,
  >(
    options: Options,
    config:
      | RakeDbCliConfigInput<SchemaConfig, ColumnTypes>
      | RakeDbConfig<ColumnTypes>,
    args?: string[],
  ): RakeDbChangeFn<ColumnTypes>;
}

export const rakeDbCliWithAdapter = ((
  inputConfig,
  args = process.argv.slice(2),
) => {
  let config;
  if ('__rakeDbConfig' in inputConfig) {
    config = inputConfig;
  } else {
    incrementIntermediateCaller();
    config = makeRakeDbConfig(inputConfig, args);
  }

  return {
    change: makeChange(config),
    async run(adapter, runArgs) {
      const adapters = toArray(adapter);

      try {
        await runCommand(adapters, config, runArgs || args);
      } catch (err) {
        if (err instanceof RakeDbError) {
          config.logger?.error(err.message);
          process.exit(1);
        }
        throw err;
      }
    },
  };
}) as RakeDbFn<MaybeArray<AdapterBase>>;

export const setRakeDbCliRunFn = <T>(
  rakeDbCli: RakeDbFn<T>,
  mapper: (options: T) => unknown,
) => {
  rakeDbCli.run = (adapter, inputConfig, args) => {
    const { change, run } = rakeDbCli(inputConfig, args);
    run(mapper(adapter) as never);
    return change;
  };
};

setRakeDbCliRunFn(rakeDbCliWithAdapter, (x) => x);

const runCommand = async (
  adapters: AdapterBase[],
  config: RakeDbConfig,
  args: string[],
) => {
  let arg = args[0]?.split(':')[0];
  if (rakeDbAliases[arg]) {
    args = [...args]; // to not mutate given arguments
    arg = args[0] = rakeDbAliases[arg] as string;
  }

  args.shift();

  const command = config.commands[arg]?.run;
  if (command) {
    await command(adapters, config, args);
  } else if (config.logger) {
    type HelpBlock = [key: string, help: string, helpArguments?: RecordString];

    const commandsHelp: HelpBlock[] = [];

    let max = 0;
    let maxArgs = 0;

    const addedCommands = new Map<RakeDbCommand, HelpBlock>();
    for (let key in config.commands) {
      const command = config.commands[key];
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

      const helpBlock: HelpBlock = [
        key,
        command.help || 'undocumented custom command',
        command.helpArguments,
      ];
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
};

const close = (adapters: AdapterBase[]) =>
  Promise.all(adapters.map((adapter) => adapter.close()));

const maybeRunRecurrent = async (
  adapters: AdapterBase[],
  config: RakeDbConfig,
) => {
  config.recurrentPath &&
    (await runRecurrentMigrations(
      adapters,
      config as { recurrentPath: string },
    ));
};

const upCommand: RakeDbCommand = {
  run: (adapters, config, args) =>
    migrateCommand(adapters, config, args)
      .then(() => maybeRunRecurrent(adapters, config))
      .then(() => close(adapters)),
  help: 'migrate pending migrations',
  helpArguments: {
    'no arguments': 'migrate all pending',
    'a number': 'run a specific number of pending migrations',
    force: 'enforce migrating a pending file in the middle',
  },
};

const downCommand: RakeDbCommand = {
  run: (adapters, config, args) =>
    rollbackCommand(adapters, config, args).then(() => close(adapters)),
  help: 'rollback migrated migrations',
  helpArguments: {
    'no arguments': 'rollback one last migration',
    'a number': 'rollback a specified number',
    all: 'rollback all migrations',
  },
};

const statusCommand: RakeDbCommand = {
  run(adapters, config, args) {
    const showUrl = args.includes('p') || args.includes('path');
    return listMigrationsStatuses(adapters, config, { showUrl });
  },
  help: 'list migrations statuses',
  helpArguments: {
    'no arguments': `does not print file paths`,
    'p, path': 'also print file paths',
  },
};

const recurrent: RakeDbCommand = {
  async run(adapters, config) {
    if (!config.recurrentPath) return;

    await maybeRunRecurrent(adapters, config).then(() => close(adapters));
  },
  help: 'run recurrent migrations',
};

export const rakeDbCommands: RakeDbCommands = {
  create: {
    run: (adapters, config) => createDatabaseCommand(adapters, config),
    help: 'create databases',
  },
  drop: {
    run: dropDatabaseCommand,
    help: 'drop databases',
  },
  reset: {
    run: (adapters, config) => resetDatabaseCommand(adapters, config),
    help: 'drop, create and migrate databases',
  },
  up: upCommand,
  down: downCommand,
  redo: {
    run: (adapters, config, args) =>
      redoCommand(adapters, config, args)
        .then(() => maybeRunRecurrent(adapters, config))
        .then(() => close(adapters)),
    help: 'rollback and migrate, run recurrent',
  },
  pull: {
    run: ([adapter], config) =>
      pullDbStructure(adapter, config).then(() => close([adapter])),
    help: 'generate a combined migration for an existing database',
  },
  new: {
    run(_, config, args) {
      const [name] = args;
      if (!name) throw new Error('Migration name is missing');

      return newMigration(config, name);
    },
    help: 'create new migration file',
  },
  status: statusCommand,
  recurrent,
  rebase: {
    run: (adapters, config) =>
      rebase(adapters, config).then(() => close(adapters)),
    help: 'move local migrations below the new ones from upstream',
  },
  'change-ids': {
    run(adapters, config, [format, digitsArg]) {
      if (format !== 'serial' && format !== 'timestamp') {
        throw new Error(
          `Pass "serial" or "timestamp" argument to the "change-ids" command`,
        );
      }

      const digits = digitsArg ? parseInt(digitsArg) : undefined;
      if (digits && isNaN(digits)) {
        throw new Error(`Second argument is optional and must be an integer`);
      }

      return changeIds(adapters, config, { format, digits });
    },
    help: 'change migrations ids format',
    helpArguments: {
      serial: 'change ids to 4 digit serial',
      'serial *number*': 'change ids to serial number of custom length',
      timestamp: 'change ids to timestamps',
    },
  },
};

for (const key in rakeDbAliases) {
  const command = rakeDbAliases[key];
  if (command) rakeDbCommands[key] = rakeDbCommands[command];
}
