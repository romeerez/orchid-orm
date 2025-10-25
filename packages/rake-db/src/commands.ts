import {
  AdapterBase,
  ColumnSchemaConfig,
  MaybePromise,
  RecordOptionalString,
  RecordString,
} from 'orchid-core';
import { AnyRakeDbConfig, RakeDbConfig } from './config';
import { createDb, dropDb, resetDb } from './commands/createOrDrop';
import { runRecurrentMigrations } from './commands/recurrent';
import {
  migrateCommand,
  redoCommand,
  rollbackCommand,
} from './commands/migrateOrRollback';
import { pullDbStructure } from './generate/pull';
import { newMigration } from './commands/newMigration';
import { rebase } from './commands/rebase';
import { changeIds } from './commands/changeIds';
import { listMigrationsStatuses } from './commands/listMigrationsStatuses';
import { RakeDbResult } from './rake-db';

export const rakeDbAliases: RecordOptionalString = {
  migrate: 'up',
  rollback: 'down',
  s: 'status',
  rec: 'recurrent',
};

export const runCommand = async <SchemaConfig extends ColumnSchemaConfig, CT>(
  adapters: AdapterBase[],
  config: RakeDbConfig<SchemaConfig, CT>,
  args: string[] = process.argv.slice(2),
): Promise<RakeDbResult> => {
  let arg = args[0]?.split(':')[0];
  if (rakeDbAliases[arg]) {
    args = [...args]; // to not mutate given arguments
    arg = args[0] = rakeDbAliases[arg] as string;
  }

  args.shift();

  const command = rakeDbCommands[arg]?.run ?? config.commands[arg];
  if (command) {
    await command(adapters, config, args);
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
    adapters,
    config,
    args,
  };
};

interface RakeDbCommand {
  run(
    adapters: AdapterBase[],
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

const close = (adapters: AdapterBase[]) =>
  Promise.all(adapters.map((adapter) => adapter.close()));

const upCommand: RakeDbCommand = {
  run: (adapters, config, args) =>
    migrateCommand(adapters, config, args)
      .then(() => runRecurrentMigrations(adapters, config))
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
  run: listMigrationsStatuses,
  help: 'list migrations statuses',
  helpArguments: {
    'no arguments': `does not print file paths`,
    'p, path': 'also print file paths',
  },
};

const recurrentCommand: RakeDbCommand = {
  run: (adapters, config) =>
    runRecurrentMigrations(adapters, config).then(() => close(adapters)),
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
    run: (adapters, config) =>
      resetDb(adapters, config)
        .then(() => runRecurrentMigrations(adapters, config))
        .then(() => close(adapters)),
    help: 'drop, create and migrate databases',
  },
  up: upCommand,
  migrate: upCommand,
  down: downCommand,
  rollback: downCommand,
  redo: {
    run: (adapters, config, args) =>
      redoCommand(adapters, config, args)
        .then(() => runRecurrentMigrations(adapters, config))
        .then(() => close(adapters)),
    help: 'rollback and migrate, run recurrent',
  },
  pull: {
    run: ([adapter], config) =>
      pullDbStructure(adapter, config).then(() => close([adapter])),
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
    run: (adapters, config) =>
      rebase(adapters, config).then(() => close(adapters)),
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
