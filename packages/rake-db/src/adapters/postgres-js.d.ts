import { PostgresJsAdapterOptions } from 'pqb/postgres-js';
import { MaybeArray } from 'pqb/internal';
import { RakeDbFn } from 'rake-db';
export declare const rakeDb: RakeDbFn<MaybeArray<PostgresJsAdapterOptions>>;
