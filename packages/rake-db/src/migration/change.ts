import { Migration } from './migration';
import { ColumnTypesBase } from 'orchid-core';

let currentChanges: ChangeCallback[] = [];

export type ChangeCallback<CT extends ColumnTypesBase = ColumnTypesBase> = (
  db: Migration<CT>,
  up: boolean,
) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (fn: ChangeCallback) => currentChanges.push(fn);
