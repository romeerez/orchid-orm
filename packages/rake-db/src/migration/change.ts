import { DbMigration } from './migration';
import { ColumnTypesBase } from 'orchid-core';

let currentChanges: ChangeCallback[] = [];

export type ChangeCallback<CT extends ColumnTypesBase = ColumnTypesBase> = (
  db: DbMigration<CT>,
  up: boolean,
) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (fn: ChangeCallback) => currentChanges.push(fn);
