import { Migration } from './migration';

const currentChanges: ChangeCallback[] = [];

export type ChangeCallback = (db: Migration, up: boolean) => Promise<void>;

export const change = (fn: ChangeCallback) => {
  currentChanges.push(fn);
};

export const clearChanges = () => {
  currentChanges.length = 0;
};

export const getCurrentChanges = () => currentChanges;
