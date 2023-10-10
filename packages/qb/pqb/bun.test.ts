import { expect, test, afterAll } from 'bun:test';
import { testDb } from 'test-utils';
import { User } from './src/test-utils/test-utils';
import { noop } from 'orchid-core';

afterAll(() => testDb.close());

test('should handle nested transactions', async () => {
  const db = testDb.log(true);
  const table = User.log(true);

  const queries: string[] = [];
  db.q.log = table.q.log = {
    afterQuery: (sql) => queries.push(sql.text),
    colors: false,
    beforeQuery: noop,
    onError: noop,
  };

  await db.transaction(async () => {
    await table;
    await db.transaction(async () => {
      await table;
    });
  });

  expect(queries).toEqual([
    'BEGIN',
    'SELECT * FROM "user"',
    'SAVEPOINT "1"',
    'SELECT * FROM "user"',
    'RELEASE SAVEPOINT "1"',
    'COMMIT',
  ]);
});
