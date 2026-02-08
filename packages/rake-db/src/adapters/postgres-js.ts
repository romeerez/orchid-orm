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
      return rakeDb.run(optionsToAdapters(options));
    },
  };
}) as RakeDbFn<MaybeArray<PostgresJsAdapterOptions>>;

const optionsToAdapters = (options: MaybeArray<PostgresJsAdapterOptions>) =>
  toArray(options).map((opts) => new PostgresJsAdapter(opts));

setRakeDbCliRunFn(rakeDb, optionsToAdapters);
