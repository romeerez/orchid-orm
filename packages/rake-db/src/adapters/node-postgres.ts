import {
  InputRakeDbConfig,
  processRakeDbConfig,
  RakeDbConfig,
  RakeDbError,
  makeChange,
  RakeDbFn,
  runCommand,
  MigrateFnConfig,
  makeMigrateAdapter,
} from 'rake-db';
import { ColumnSchemaConfig, MaybeArray, toArray } from 'orchid-core';
import {
  NodePostgresAdapter,
  NodePostgresAdapterOptions,
} from 'pqb/node-postgres';
import { DefaultSchemaConfig } from 'pqb';

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
}) as RakeDbFn<MaybeArray<NodePostgresAdapterOptions>>;

rakeDb.lazy = ((
  options: MaybeArray<NodePostgresAdapterOptions>,
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

const optionsToAdapters = (options: MaybeArray<NodePostgresAdapterOptions>) =>
  toArray(options).map((opts) => new NodePostgresAdapter(opts));

export const makeConnectAndMigrate = (
  config?: Partial<MigrateFnConfig>,
): ((
  options: MaybeArray<NodePostgresAdapterOptions>,
  params?: { count?: number; force?: boolean },
) => Promise<void>) => {
  const migrateAdapter = makeMigrateAdapter(config);

  return async (options, params) => {
    for (const adapter of optionsToAdapters(options)) {
      await migrateAdapter(adapter, params);
    }
  };
};
