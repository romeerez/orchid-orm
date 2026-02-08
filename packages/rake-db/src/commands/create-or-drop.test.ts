import { testAdapter } from 'test-utils';
import {
  createDatabase,
  CreateOrDropError,
  createSchema,
  createTable,
  dropDatabase,
  dropSchema,
  dropTable,
} from './create-or-drop';

const adapter = testAdapter;
const query = jest.spyOn(adapter, 'query').mockImplementation();
jest.spyOn(adapter, 'transaction').mockImplementation((_, fn) => {
  const trx = Object.create(adapter);
  trx.query = query;
  trx.isInTransaction = () => true;
  return fn(trx);
});

describe('create-or-drop', () => {
  beforeEach(jest.clearAllMocks);

  describe.each`
    method              | fn
    ${'createDatabase'} | ${createDatabase}
    ${'dropDatabase'}   | ${dropDatabase}
  `('$method', ({ method, fn }) => {
    const act = () =>
      fn(adapter, {
        database: 'db-name',
        owner: 'username',
      });

    it('should run successfully', async () => {
      const result = await act();

      expect(result).toEqual('done');
      expect(query).toHaveBeenCalledWith(
        method === 'createDatabase'
          ? `CREATE DATABASE "db-name" OWNER "username"`
          : `DROP DATABASE "db-name"`,
      );
    });

    it('should return ok: already if db is already created/dropped', async () => {
      const err = Object.assign(new Error(), {
        code: method === 'createDatabase' ? '42P04' : '3D000',
      });
      query.mockRejectedValueOnce(err);

      const result = await act();

      expect(result).toEqual('already');
    });

    it('should return ssl error if it is required', async () => {
      const err = new Error('sslmode=require');
      query.mockRejectedValueOnce(err);

      await expect(act()).rejects.toThrow(
        new CreateOrDropError('SSL required', 'ssl-required', err),
      );
    });

    it('should return forbidden error if insufficient privilege', async () => {
      const err = Object.assign(new Error(), {
        code: '42501',
      });
      query.mockRejectedValueOnce(err);

      await expect(act()).rejects.toThrow(
        new CreateOrDropError('Insufficient privilege', 'forbidden', err),
      );
    });

    it('should return auth-failed error if auth failed', async () => {
      const err = new Error('password authentication failed');
      query.mockRejectedValueOnce(err);

      await expect(act()).rejects.toThrow(
        new CreateOrDropError('Authentication failed', 'auth-failed', err),
      );
    });

    it('should return unexpected error', async () => {
      const err = new Error();
      query.mockRejectedValueOnce(err);

      await expect(act()).rejects.toThrow(err);
    });
  });

  describe.each`
    name              | fn              | code
    ${'createSchema'} | ${createSchema} | ${'42P06'}
    ${'dropSchema'}   | ${dropSchema}   | ${'3F000'}
    ${'createTable'}  | ${createTable}  | ${'42P07'}
    ${'dropTable'}    | ${dropTable}    | ${'42P01'}
  `(
    '$name',
    ({
      fn,
      code,
    }: {
      fn:
        | typeof createSchema
        | typeof dropSchema
        | typeof createTable
        | typeof dropTable;
      code: string;
    }) => {
      const sql = fn.name.endsWith('Table')
        ? fn.name.startsWith('create')
          ? '"schema"."table" (name text)'
          : '"schema"."table"'
        : '"schema"';
      const action = fn.name.startsWith('create') ? 'CREATE' : 'DROP';
      const keyword = fn.name.endsWith('Table') ? 'TABLE' : 'SCHEMA';

      const act = () => fn(adapter, sql);
      const actInTransaction = () =>
        adapter.transaction(undefined, (trx) => fn(trx, sql));

      it('should do the thing', async () => {
        const res = await act();

        expect(res).toBe('done');
        expect(query).toHaveBeenCalledWith(`${action} ${keyword} ${sql}`);
      });

      it('should do the thing in transaction', async () => {
        const res = await actInTransaction();

        expect(res).toBe('done');
        expect(query).toHaveBeenCalledWith(
          `SAVEPOINT s; ${action} ${keyword} ${sql}; RELEASE SAVEPOINT s`,
        );
      });

      it('should return `already` if it is already done', async () => {
        query.mockRejectedValueOnce({
          code,
        });

        const res = await act();

        expect(res).toBe('already');
      });

      it('should rollback when in transaction and it was already done', async () => {
        query.mockRejectedValueOnce({
          code,
        });

        const res = await actInTransaction();

        expect(res).toBe('already');
        expect(query).toHaveBeenCalledWith(`ROLLBACK TO SAVEPOINT s`);
      });

      it('should rethrow error', async () => {
        const err = new Error();
        query.mockRejectedValueOnce(err);

        await expect(act()).rejects.toThrow(err);
      });
    },
  );
});
