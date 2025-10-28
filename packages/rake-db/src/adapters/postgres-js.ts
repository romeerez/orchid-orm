import {
  RakeDbConfig,
  makeChange,
  RakeDbFn,
  runCommand,
  InputRakeDbConfig,
  processRakeDbConfig,
  MigrateFnConfig,
  makeMigrateAdapter,
  RakeDbError,
} from 'rake-db';
import { PostgresJsAdapter, PostgresJsAdapterOptions } from 'pqb/postgres-js';
import {
  DefaultSchemaConfig,
  ColumnSchemaConfig,
  MaybeArray,
  toArray,
} from 'pqb';

export const rakeDb = ((
  options,
  partialConfig,
  args = process.argv.slice(2),
) => {
  const config = processRakeDbConfig(partialConfig);

  const promise = runCommand(
    optionsToAdapters(options),
    config as unknown as RakeDbConfig<ColumnSchemaConfig>,
    args,
  ).catch((err) => {
    if (err instanceof RakeDbError) {
      config.logger?.error(err.message);
      process.exit(1);
    }
    throw err;
  });

  return Object.assign(makeChange(config), {
    promise,
  });
}) as RakeDbFn<PostgresJsAdapterOptions>;

rakeDb.lazy = ((
  options: MaybeArray<PostgresJsAdapterOptions>,
  partialConfig: InputRakeDbConfig<ColumnSchemaConfig, unknown>,
) => {
  const config = processRakeDbConfig(partialConfig);

  return {
    change: makeChange(config),
    run(
      args: string[],
      conf: Partial<RakeDbConfig<DefaultSchemaConfig, unknown>>,
    ) {
      return runCommand(
        optionsToAdapters(options),
        conf ? { ...config, ...conf } : config,
        args,
      );
    },
  };
}) as never;

const optionsToAdapters = (options: MaybeArray<PostgresJsAdapterOptions>) =>
  toArray(options).map((opts) => new PostgresJsAdapter(opts));

export const makeConnectAndMigrate = (
  config?: Partial<MigrateFnConfig>,
): ((
  options: MaybeArray<PostgresJsAdapterOptions>,
  params?: { count?: number; force?: boolean },
) => Promise<void>) => {
  const migrateAdapter = makeMigrateAdapter(config);

  return async (options, params) => {
    for (const adapter of optionsToAdapters(options)) {
      await migrateAdapter(adapter, params);
    }
  };
};
