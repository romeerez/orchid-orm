import { Migration } from './migration';

let currentMigration: Migration | undefined;
let currentPromise: Promise<void> | undefined;
let currentUp = true;
let currentChangeCallback: ChangeCallback | undefined;

export type ChangeCallback = (db: Migration, up: boolean) => Promise<void>;

export const change = (fn: ChangeCallback) => {
  if (!currentMigration) throw new Error('Database instance is not set');
  currentPromise = fn(currentMigration, currentUp);
  currentChangeCallback = fn;
};

export const setCurrentMigration = (db: Migration) => {
  currentMigration = db;
};

export const setCurrentMigrationUp = (up: boolean) => {
  currentUp = up;
};

export const getCurrentPromise = () => currentPromise;

export const getCurrentChangeCallback = () => currentChangeCallback;
