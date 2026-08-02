import { Adapter, PickQueryQ, QueryData } from 'pqb/internal';
export interface OrmParam {
    $qb?: PickQueryQ;
    q?: QueryData;
    $getAdapter(): Adapter;
}
export type DbParam = OrmParam | Adapter;
export declare const getMaybeTransactionAdapter: (db: DbParam) => Adapter;
export declare const runSqlInSavePoint: (db: DbParam, sql: string, code: string) => Promise<'done' | 'already'>;
