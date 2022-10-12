import { Migration } from './migration';

let currentMigration: Migration | undefined;
let currentPromise: Promise<void> | undefined;
let currentUp = true;

export const change = (fn: (db: Migration, up: boolean) => Promise<void>) => {
  if (!currentMigration) throw new Error('Database instance is not set');
  currentPromise = fn(currentMigration, currentUp);
};

export const setCurrentMigration = (db: Migration) => {
  currentMigration = db;
};

export const setCurrentMigrationUp = (up: boolean) => {
  currentUp = up;
};

export const getCurrentPromise = () => currentPromise;
