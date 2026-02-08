import {
  NodePostgresAdapter,
  NodePostgresAdapterOptions,
} from 'pqb/node-postgres';
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
}) as RakeDbFn<MaybeArray<NodePostgresAdapterOptions>>;

const optionsToAdapters = (options: MaybeArray<NodePostgresAdapterOptions>) =>
  toArray(options).map((opts) => new NodePostgresAdapter(opts));

setRakeDbCliRunFn(rakeDb, optionsToAdapters);
