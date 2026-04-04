import {
  AdapterBase,
  ColumnSchemaConfig,
  DefaultColumnTypes,
  defaultSchemaConfig,
  getStackTrace,
  makeColumnTypes as defaultColumnTypes,
  RecordOptionalString,
} from 'pqb/internal';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { getCliParam } from './common';
import {
  rakeDbConfigDefaults,
  RakeDbCliConfigInput,
  RakeDbCommand,
  RakeDbCommands,
  RakeDbConfig,
} from './config';
import {
  createDatabaseCommand,
  dropDatabaseCommand,
  resetDatabaseCommand,
} from './cli/database.cli';
import {
  migrateCommand,
  redoCommand,
  rollbackCommand,
} from './cli/migrate.cli';
import { runRecurrentMigrations } from './commands/recurrent';
import { pullDbStructure } from './generate/pull';
import { newMigration } from './commands/new-migration';
import { listMigrationsStatuses } from './commands/list-migrations-statuses';
import { rebase } from './commands/rebase';
import { changeIds } from './commands/change-ids';
import { processMigrateConfig } from './commands/migrate-or-rollback';

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

const rakeDbAliases: RecordOptionalString = {
  migrate: 'up',
  rollback: 'down',
  s: 'status',
  rec: 'recurrent',
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
      timestamp: 'change timestamps',
    },
  },
};

for (const key in rakeDbAliases) {
  const command = rakeDbAliases[key];
  if (command) rakeDbCommands[key] = rakeDbCommands[command];
}

let intermediateCallers = 0;
export const incrementIntermediateCaller = () => {
  intermediateCallers++;
};

const ensureBasePathAndDbScript = <
  T extends {
    basePath?: string;
    dbScript?: string;
  },
>(
  config: T,
  intermediateCallers = 0,
): T & { basePath: string; dbScript: string } => {
  if (config.basePath && config.dbScript) return config as never;

  let filePath = getStackTrace()?.[3 + intermediateCallers]?.getFileName();
  if (!filePath) {
    throw new Error(
      'Failed to determine path to db script. Please set basePath option of rakeDb',
    );
  }

  if (filePath.startsWith('file://')) {
    filePath = fileURLToPath(filePath);
  }

  const ext = path.extname(filePath);
  if (ext !== '.ts' && ext !== '.js' && ext !== '.mjs') {
    throw new Error(
      `Add a .ts suffix to the "${path.basename(filePath)}" when calling it`,
    );
  }

  config.basePath = path.dirname(filePath);
  config.dbScript = path.basename(filePath);
  return config as never;
};

export const makeRakeDbConfig = <ColumnTypes>(
  config: RakeDbCliConfigInput<ColumnSchemaConfig, ColumnTypes>,
  args?: string[],
): RakeDbConfig<ColumnTypes> => {
  const ic = intermediateCallers;
  intermediateCallers = 0;

  const result = {
    ...rakeDbConfigDefaults,
    ...config,
    __rakeDbConfig: true,
  } as unknown as RakeDbConfig<ColumnTypes>;

  ensureBasePathAndDbScript(result, ic);
  Object.assign(result, processMigrateConfig(result));

  if (!result.recurrentPath && result.migrationsPath) {
    result.recurrentPath = path.join(result.migrationsPath, 'recurrent');
  }

  if (result.recurrentPath && !path.isAbsolute(result.recurrentPath)) {
    result.recurrentPath = path.resolve(result.basePath, result.recurrentPath);
  }

  if ('baseTable' in config && config.baseTable) {
    const { types, snakeCase, language } = config.baseTable.prototype;
    result.columnTypes = types || defaultColumnTypes(defaultSchemaConfig);
    if (snakeCase) result.snakeCase = true;
    if (language) result.language = language;
  } else {
    const ct = 'columnTypes' in config && config.columnTypes;
    result.columnTypes = ((typeof ct === 'function'
      ? (ct as (t: DefaultColumnTypes<ColumnSchemaConfig>) => unknown)(
          defaultColumnTypes(defaultSchemaConfig),
        )
      : ct) || defaultColumnTypes(defaultSchemaConfig)) as ColumnTypes;
  }

  if (config.migrationId === 'serial') {
    result.migrationId = { serial: 4 };
  }

  const transaction = getCliParam(args, 'transaction');
  if (transaction) {
    if (transaction !== 'single' && transaction !== 'per-migration') {
      throw new Error(
        `Unsupported transaction param ${transaction}, expected single or per-migration`,
      );
    }
    result.transaction = transaction;
  } else if (!result.transaction) {
    result.transaction = 'single';
  }

  let c = rakeDbCommands;
  if (config.commands) {
    c = { ...c };
    const commands = config.commands;
    for (const key in commands) {
      const command = commands[key];
      c[key] = typeof command === 'function' ? { run: command } : command;
    }
  }
  result.commands = c;

  return result;
};
