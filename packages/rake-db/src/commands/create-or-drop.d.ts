import { DbParam } from '../utils';
export declare class CreateOrDropError extends Error {
    status: 'forbidden' | 'auth-failed' | 'ssl-required';
    cause: unknown;
    constructor(message: string, status: 'forbidden' | 'auth-failed' | 'ssl-required', cause: unknown);
}
export type CreateOrDropOk = 'done' | 'already';
/**
 * To create a database, clone the connection with a power user and an existing database to connect to.
 *
 * ```ts
 * import { createDatabase } from 'orchid-orm/migrations';
 *
 * const adapter = db.$adapter.clone({
 *   user: 'postgres',
 *   database: 'postgres',
 * });
 *
 * await createDatabase(adapter, {
 *   database: 'database-to-create',
 *   owner: 'username', // optional
 * });
 * ```
 */
export declare const createDatabase: (db: DbParam, { database, owner, }: {
    database: string;
    owner?: string;
}) => Promise<CreateOrDropOk>;
/**
 * To drop a database, clone the connection with a power user and a different database to connect to.
 *
 * Ensure the connections to the database are closed before dropping, because Postgres won't be able to drop it otherwise.
 *
 * ```ts
 * import { createDatabase } from 'orchid-orm/migrations';
 *
 * const adapter = db.$adapter.clone({
 *   user: 'postgres',
 *   database: 'postgres',
 * });
 *
 * await createDatabase(adapter, {
 *   database: 'database-to-create',
 *   owner: 'username', // optional
 * });
 * ```
 */
export declare const dropDatabase: (db: DbParam, { database }: {
    database: string;
}) => Promise<CreateOrDropOk>;
/**
 * `createSchema` uses a savepoint when it is called in a transaction to not break it if the schema already exists.
 *
 * Prepends `CREATE SCHEMA` to a given SQL.
 *
 * ```ts
 * import { createSchema } from 'orchid-orm/migrations';
 *
 * const result: 'done' | 'already' = await createSchema(db, '"schema"');
 * ```
 */
export declare const createSchema: (db: DbParam, sql: string) => Promise<'done' | 'already'>;
/**
 * `dropSchema` uses a savepoint when it is called in a transaction to not break it if the schema does not exist.
 *
 * Prepends `DROP SCHEMA` to a given SQL.
 *
 * ```ts
 * import { dropSchema } from 'orchid-orm/migrations';
 *
 * const result: 'done' | 'already' = await dropSchema(db, '"schema"');
 * ```
 */
export declare const dropSchema: (db: DbParam, sql: string) => Promise<'done' | 'already'>;
/**
 * `createTable` uses a savepoint when it is called in a transaction to not break it if the table already exists.
 *
 * Prepends `CREATE TABLE` to a given SQL.
 *
 * ```ts
 * import { createTable } from 'orchid-orm/migrations';
 *
 * const result: 'done' | 'already' = await createTable(db, '"table"');
 * ```
 */
export declare const createTable: (db: DbParam, sql: string) => Promise<'done' | 'already'>;
/**
 * `dropTable` uses a savepoint when it is called in a transaction to not break it if the table does not exist.
 *
 * Prepends `DROP TABLE` to a given SQL.
 *
 * ```ts
 * import { dropTable } from 'orchid-orm/migrations';
 *
 * const result: 'done' | 'already' = await dropTable(db, '"table"');
 * ```
 */
export declare const dropTable: (db: DbParam, sql: string) => Promise<'done' | 'already'>;
