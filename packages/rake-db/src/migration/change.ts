import { Adapter } from 'pqb';

let currentDb: Adapter | undefined;
let currentPromise: Promise<void> | undefined;
let currentUp = true;

export const change = (fn: (db: Adapter, up: boolean) => Promise<void>) => {
  if (!currentDb) throw new Error('Database instance is not set');
  currentPromise = fn(currentDb, currentUp);
};

export const setDbForMigration = (db: Adapter) => {
  currentDb = db;
};

export const setCurrentMigrationUp = (up: boolean) => {
  currentUp = up;
};

export const getCurrentPromise = () => currentPromise;
