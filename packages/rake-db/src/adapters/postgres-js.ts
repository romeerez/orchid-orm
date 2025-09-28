import { InputRakeDbConfig, processRakeDbConfig } from '../config';
import { RakeDbConfig } from 'rake-db';
import { ColumnSchemaConfig, MaybeArray, toArray } from 'orchid-core';
import { RakeDbError } from '../errors';
import { makeChange, RakeDbFn, runCommand } from '../rakeDb';
import { PostgresJsAdapter, PostgresJsAdapterOptions } from 'pqb/postgres-js';
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
