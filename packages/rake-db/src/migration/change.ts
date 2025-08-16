import { DbMigration } from './migration';
import { RakeDbConfig } from '../config';
import { ColumnSchemaConfig } from 'orchid-core';

export interface MigrationChange {
  fn: ChangeCallback<unknown>;
  config: RakeDbConfig<ColumnSchemaConfig, unknown>;
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
