import { DbMigration } from './migration';

export interface RakeDbChangeFnConfig<ColumnTypes> {
  columnTypes: ColumnTypes;
}

/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export interface MigrationChangeFn<ColumnTypes> {
  (fn: ChangeCallback<ColumnTypes>): MigrationChange;
}

export const createMigrationChangeFn = <ColumnTypes>(
  config: RakeDbChangeFnConfig<ColumnTypes>,
): MigrationChangeFn<ColumnTypes> => {
  return (fn) => {
    const change: MigrationChange = { fn: fn as never, config };
    pushChange(change);
    return change;
  };
};

export interface MigrationChange {
  fn: ChangeCallback<unknown>;
  config: RakeDbChangeFnConfig<unknown>;
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
