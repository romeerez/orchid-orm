import { PostgresJsAdapter, PostgresJsAdapterOptions } from 'pqb/postgres-js';
import { MaybeArray, toArray } from 'pqb';
import {
  rakeDbCliWithAdapter,
  RakeDbFn,
  setRakeDbCliRunFn,
  incrementIntermediateCaller,
} from 'rake-db';

export const rakeDb = ((inputConfig, args = process.argv.slice(2)) => {
  if (!('__rakeDbConfig' in inputConfig)) {
    incrementIntermediateCaller();
  }

  const rakeDb = rakeDbCliWithAdapter(inputConfig, args);
  return {
    ...rakeDb,
    run(options) {
      const adapters = toArray(options).map(
        (opts) => new PostgresJsAdapter(opts),
      );
      return rakeDb.run(adapters);
    },
  };
}) as RakeDbFn<MaybeArray<PostgresJsAdapterOptions>>;

setRakeDbCliRunFn(rakeDb);
