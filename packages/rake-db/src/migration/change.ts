import { DbMigration } from './migration';
import {
  DefaultColumnTypes,
  defaultSchemaConfig,
  DefaultSchemaConfig,
  makeColumnTypes,
} from 'pqb/internal';

export interface RakeDbChangeFnConfig {
  columnTypes: unknown;
}

/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export interface MigrationChangeFn<ColumnTypes> {
  (fn: ChangeCallback<ColumnTypes>): MigrationChange;
}

export const createMigrationChangeFn = <
  ColumnTypes = DefaultColumnTypes<DefaultSchemaConfig>,
>(config: {
  columnTypes?: ColumnTypes;
}): MigrationChangeFn<ColumnTypes> => {
  const conf = config.columnTypes
    ? (config as RakeDbChangeFnConfig)
    : { columnTypes: makeColumnTypes(defaultSchemaConfig) };

  return (fn) => {
    const change: MigrationChange = { fn: fn as never, config: conf };
    pushChange(change);
    return change;
  };
};

export interface MigrationChange {
  fn: ChangeCallback<unknown>;
  config: RakeDbChangeFnConfig;
}

let currentChanges: MigrationChange[] = [];

export type ChangeCallback<ColumnTypes> = (
  db: DbMigration<ColumnTypes>,
  up: boolean,
) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (change: MigrationChange) =>
  currentChanges.push(change);
