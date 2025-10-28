import {
  DefaultColumnTypes,
  DefaultSchemaConfig,
  AdapterBase,
  ColumnSchemaConfig,
} from 'pqb';
import { RakeDbError } from './errors';
import {
  ChangeCallback,
  MigrationChange,
  pushChange,
} from './migration/change';
import {
  AnyRakeDbConfig,
  InputRakeDbConfig,
  processRakeDbConfig,
  RakeDbConfig,
} from './config';
import { runCommand } from './commands';

/**
 * Type of {@link rakeDbWithAdapters} function
 */
export interface RakeDbFn<Options> {
  <
    SchemaConfig extends ColumnSchemaConfig,
    CT = DefaultColumnTypes<DefaultSchemaConfig>,
  >(
    options: Options,
    partialConfig: InputRakeDbConfig<SchemaConfig, CT>,
    args?: string[],
  ): RakeDbChangeFnWithPromise<CT>;

  /**
   * Unlike the original `rakeDb` that executes immediately,
   * `rakeDb.lazy` returns the `run` function to be later called programmatically.
   *
   * @param options - array of connection adapters for migrating multiple dbs
   * @param config - {@link RakeDbConfig}
   * @returns `change` is to be used in migrations, `run` takes an array cli args to execute a command
   */
  lazy<
    SchemaConfig extends ColumnSchemaConfig,
    CT = DefaultColumnTypes<DefaultSchemaConfig>,
  >(
    options: Options,
    config: InputRakeDbConfig<SchemaConfig, CT>,
  ): {
    change: RakeDbChangeFn<CT>;
    run(
      args: string[],
      config?: Partial<RakeDbConfig<SchemaConfig, CT>>,
    ): Promise<RakeDbResult>;
  };
}

export interface RakeDbResult {
  // database connection adapters
  adapters: AdapterBase[];
  // rake-db config
  config: AnyRakeDbConfig;
  // command and arguments passed to `rakeDb.lazy` or taken from process.argv
  args: string[];
}

/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export interface RakeDbChangeFn<CT> {
  (fn: ChangeCallback<CT>): MigrationChange;
}

export interface RakeDbChangeFnWithPromise<CT> extends RakeDbChangeFn<CT> {
  promise: Promise<RakeDbResult>;
}

/**
 * Function to configure and run `rakeDb`.
 *
 * @param options - {@link NodePostgresAdapterOptions} or an array of such options to migrate multiple dbs
 * @param config - {@link RakeDbConfig}
 * @param args - optionally provide an array of cli args. Default is `process.argv.slice(2)`.
 */
export const rakeDbWithAdapters = ((
  adapters,
  partialConfig,
  args = process.argv.slice(2),
) => {
  const config = processRakeDbConfig(partialConfig);
  const promise = runCommand(
    adapters,
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
}) as RakeDbFn<AdapterBase[]>;

rakeDbWithAdapters.lazy = ((
  adapters: AdapterBase[],
  partialConfig: InputRakeDbConfig<ColumnSchemaConfig, unknown>,
) => {
  const config = processRakeDbConfig(partialConfig);

  return {
    change: makeChange(config),
    run(
      args: string[],
      conf: Partial<RakeDbConfig<DefaultSchemaConfig, unknown>>,
    ) {
      return runCommand(adapters, conf ? { ...config, ...conf } : config, args);
    },
  };
}) as never;

export const makeChange =
  (config: RakeDbConfig<ColumnSchemaConfig, unknown>) =>
  (fn: ChangeCallback<unknown>) => {
    const change: MigrationChange = { fn, config };
    pushChange(change);
    return change;
  };
