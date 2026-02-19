import { BunSqlAdapter, BunSqlAdapterOptions } from 'pqb/bun-sql';
import { MaybeArray, toArray } from 'pqb';
import {
  incrementIntermediateCaller,
  rakeDbCliWithAdapter,
  RakeDbFn,
  setRakeDbCliRunFn,
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
        (opts: BunSqlAdapterOptions) => new BunSqlAdapter(opts),
      );
      return rakeDb.run(adapters);
    },
  };
}) as RakeDbFn<MaybeArray<BunSqlAdapterOptions>>;

setRakeDbCliRunFn(rakeDb);
