import { DbMigration } from './migration';

let currentChanges: ChangeCallback<unknown>[] = [];

export type ChangeCallback<CT> = (
  db: DbMigration<CT>,
  up: boolean,
) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (fn: ChangeCallback<unknown>) =>
  currentChanges.push(fn);
