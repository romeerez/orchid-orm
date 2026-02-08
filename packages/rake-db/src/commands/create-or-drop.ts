import { RecordUnknown } from 'pqb';
import { DbParam, getNonTransactionAdapter, runSqlInSavePoint } from '../utils';

export class CreateOrDropError extends Error {
  constructor(
    message: string,
    public status: 'forbidden' | 'auth-failed' | 'ssl-required',
    public cause: unknown,
  ) {
    super(message);
  }
}

export type CreateOrDropOk = 'done' | 'already';

/**
 * To create a database, reconfigure the connection with a power user and an existing database to connect to.
 *
 * ```ts
 * import { createDatabase } from 'orchid-orm/migrations';
 *
 * const adapter = db.$adapter.reconfigure({
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
export const createDatabase = async (
  db: DbParam,
  {
    database,
    owner,
  }: {
    database: string;
    owner?: string;
  },
) => {
  return createOrDrop(
    db,
    `CREATE DATABASE "${database}"${owner ? ` OWNER "${owner}"` : ''}`,
  );
};

/**
 * To drop a database, reconfigure the connection with a power user and a different database to connect to.
 *
 * Ensure the connections to the database are closed before dropping, because Postgres won't be able to drop it otherwise.
 *
 * ```ts
 * import { createDatabase } from 'orchid-orm/migrations';
 *
 * const adapter = db.$adapter.reconfigure({
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
export const dropDatabase = async (
  db: DbParam,
  { database }: { database: string },
): Promise<CreateOrDropOk> => {
  return createOrDrop(db, `DROP DATABASE "${database}"`);
};

const createOrDrop = async (
  db: DbParam,
  sql: string,
): Promise<CreateOrDropOk> => {
  try {
    const adapter = getNonTransactionAdapter(db);
    await adapter.query(sql);
    return 'done';
  } catch (error) {
    const err = error as RecordUnknown;

    if (
      typeof err.message === 'string' &&
      err.message.includes('sslmode=require')
    ) {
      throw new CreateOrDropError('SSL required', 'ssl-required', err);
    }

    if (err.code === '42P04' || err.code === '3D000') {
      return 'already';
    }

    if (err.code === '42501') {
      throw new CreateOrDropError('Insufficient privilege', 'forbidden', err);
    }

    if (
      typeof err.message === 'string' &&
      err.message.includes('password authentication failed')
    ) {
      throw new CreateOrDropError('Authentication failed', 'auth-failed', err);
    }

    throw err;
  }
};

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
export const createSchema = async (
  db: DbParam,
  sql: string,
): Promise<'done' | 'already'> =>
  runSqlInSavePoint(db, `CREATE SCHEMA ${sql}`, '42P06');

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
export const dropSchema = async (
  db: DbParam,
  sql: string,
): Promise<'done' | 'already'> =>
  runSqlInSavePoint(db, `DROP SCHEMA ${sql}`, '3F000');

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
export const createTable = async (
  db: DbParam,
  sql: string,
): Promise<'done' | 'already'> =>
  runSqlInSavePoint(db, `CREATE TABLE ${sql}`, '42P07');

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
export const dropTable = async (
  db: DbParam,
  sql: string,
): Promise<'done' | 'already'> =>
  runSqlInSavePoint(db, `DROP TABLE ${sql}`, '42P01');
