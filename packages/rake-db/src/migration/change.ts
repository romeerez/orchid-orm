import { DbMigration } from './migration';
import { RakeDbConfig } from '../config';

/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export interface RakeDbChangeFn<CT> {
  (fn: ChangeCallback<CT>): MigrationChange;
}

export const makeChange =
  <CT>(config: RakeDbConfig): RakeDbChangeFn<CT> =>
  (fn) => {
    const change: MigrationChange = { fn: fn as never, config };
    pushChange(change);
    return change;
  };

export interface MigrationChange {
  fn: ChangeCallback<unknown>;
  config: RakeDbConfig;
}

let currentChanges: MigrationChange[] = [];

export type ChangeCallback<CT> = (
  db: DbMigration<CT>,
  up: boolean,
) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (change: MigrationChange) =>
  currentChanges.push(change);
