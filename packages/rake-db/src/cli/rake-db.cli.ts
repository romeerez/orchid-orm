import {
  AdapterBase,
  ColumnSchemaConfig,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  MaybeArray,
  RecordOptionalString,
  RecordString,
  toArray,
} from 'pqb/internal';
import {
  incrementIntermediateCaller,
  makeRakeDbConfig,
} from '../config.public';
import { RakeDbCliConfigInput, RakeDbCommand, RakeDbConfig } from '../config';
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
  let config: RakeDbConfig;
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

export const setRakeDbCliRunFn = <T>(rakeDbCli: RakeDbFn<T>) => {
  rakeDbCli.run = (options, inputConfig, args) => {
    if (!('__rakeDbConfig' in inputConfig)) {
      incrementIntermediateCaller();
    }
    const { change, run } = rakeDbCli(inputConfig, args);
    run(options);
    return change;
  };
};

setRakeDbCliRunFn(rakeDbCliWithAdapter);

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
