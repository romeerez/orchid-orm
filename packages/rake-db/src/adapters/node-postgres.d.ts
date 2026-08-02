import { NodePostgresAdapterOptions } from 'pqb/node-postgres';
import { MaybeArray } from 'pqb/internal';
import { RakeDbFn } from 'rake-db';
export declare const rakeDb: RakeDbFn<MaybeArray<NodePostgresAdapterOptions>>;
