import { Snake, User } from '../../../test-utils/pqb.test-utils';
import { expectSql, useTestDatabase } from 'test-utils';
import { copyTableData } from './copy-table-data';

describe('copy', () => {
  useTestDatabase();

  const columns = ['name', 'password'] as ['name', 'password'];
  const options = {
    columns: columns,
    format: 'csv' as const,
    freeze: true,
    delimiter: ',',
    null: 'null',
    header: 'match' as const,
    quote: 'quote',
    escape: 'escape',
    forceQuote: columns,
    forceNotNull: columns,
    forceNull: columns,
    encoding: 'encoding',
  };

  describe.each`
    method    | sql
    ${'from'} | ${'FROM'}
    ${'to'}   | ${'TO'}
  `('$method', ({ method, sql }) => {
    it(`should copy ${method}`, () => {
      const q = copyTableData(User, {
        [method as 'from']: 'path-to-file',
      });

      expectSql(q.toSQL(), `COPY "user" ${sql} 'path-to-file'`);
    });

    it(`should copy ${method} with options`, () => {
      const q = copyTableData(User, {
        [method as 'from']: { program: 'program' },
        ...options,
      });

      expectSql(
        q.toSQL(),
        `
        COPY "user"("name", "password")
        ${sql} PROGRAM 'program'
        WITH (
          FORMAT csv,
          FREEZE true,
          DELIMITER ',',
          NULL 'null',
          HEADER match,
          QUOTE 'quote',
          ESCAPE 'escape',
          FORCE_QUOTE ("name", "password"),
          FORCE_NOT_NULL ("name", "password"),
          FORCE_NULL ("name", "password"),
          ENCODING 'encoding'
        )
      `,
      );
    });

    it(`should copy ${method} with columns with names`, () => {
      const q = copyTableData(Snake, {
        [method as 'from']: 'path-to-file',
        columns: ['snakeName', 'tailLength'],
      });

      expectSql(
        q.toSQL(),
        `COPY "snake"("snake_name", "tail_length") ${sql} 'path-to-file'`,
      );
    });
  });
});
