import { Migration } from './migration';

let currentChanges: ChangeCallback[] = [];

export type ChangeCallback = (db: Migration, up: boolean) => Promise<void>;

export const change = (fn: ChangeCallback) => {
  currentChanges.push(fn);
};

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
