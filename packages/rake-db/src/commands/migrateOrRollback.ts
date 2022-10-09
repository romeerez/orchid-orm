import { AdapterOptions, MaybeArray, toArray } from 'pqb';
import { MigrationConfig } from './common';

const migrateOrRollback = (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
  up: boolean,
) => {
  console.log(config, up);

  for (const opts of toArray(options)) {
    console.log(opts);
  }
};

export const migrate = (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
) => migrateOrRollback(options, config, true);

export const rollback = (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
) => migrateOrRollback(options, config, false);
