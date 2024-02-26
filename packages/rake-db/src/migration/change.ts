import { DbMigration, RakeDbColumnTypes } from './migration';

let currentChanges: ChangeCallback<RakeDbColumnTypes>[] = [];

export type ChangeCallback<CT extends RakeDbColumnTypes> = (
  db: DbMigration<CT>,
  up: boolean,
) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (fn: ChangeCallback<RakeDbColumnTypes>) =>
  currentChanges.push(fn);
