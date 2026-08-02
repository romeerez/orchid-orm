import { Query } from '../query/query';
import { escapeForLog } from '../quote';
import { expectSql, testDb } from 'test-utils';
import { RecordUnknown } from '../utils';
import { quoteTableWithSchemaAndAlias } from '../query/sql/sql';
import {
  QueryResult,
  QueryResultRow,
  TransactionAdapterClass,
} from '../adapters/adapter';

export const expectQueryNotMutated = (q: Query) => {
  const select = q.q.selectAllColumns?.join(', ') ?? '*';
  expectSql(
    q.toSQL(),
    `SELECT ${select} FROM ${quoteTableWithSchemaAndAlias(q)}`,
  );
};

export const insert = async <T extends RecordUnknown & { id: number }>(
  table: string,
  record: T,
): Promise<T> => {
  const columns = Object.keys(record);
  const result = await testDb.adapter.query<{ id: number }>(
    `INSERT INTO "${table}"(${columns
      .map((column) => `"${column}"`)
      .join(', ')}) VALUES (${columns
      .map((column) => escapeForLog(record[column]))
      .join(', ')}) RETURNING "id"`,
  );

  record.id = result.rows[0].id;
  return record;
};

export const userData = {
  name: 'name',
  password: 'password',
};

export const profileData = {
  bio: 'text',
};

export const messageData = {
  Text: 'text',
  MessageKey: 'key',
};

export const uniqueTableData = {
  one: 'one',
  two: 2,
  thirdColumn: 'three',
  fourthColumn: 4,
};

export const emulateReturnNoRowsOnce = (
  method: 'query' | 'arrays' = 'query',
) => {
  // emulate the edge case when first query doesn't find the record, and then in CTE it appears
  if (method === 'query') {
    const query = TransactionAdapterClass.prototype.query;
    TransactionAdapterClass.prototype.query = async function <
      T extends QueryResultRow = QueryResultRow,
    >(this: TransactionAdapterClass, text: string, values?: unknown[]) {
      const result = await query.call(this, text, values);
      result.rowCount = 0;
      TransactionAdapterClass.prototype.query = query;
      return result as QueryResult<T>;
    };
  } else {
    const arrays = TransactionAdapterClass.prototype.arrays;
    TransactionAdapterClass.prototype.arrays = async function <
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      R extends any[] = any[],
    >(this: TransactionAdapterClass, text: string, values?: unknown[]) {
      const result = await arrays.call(this, text, values);
      result.rowCount = 0;
      TransactionAdapterClass.prototype.arrays = arrays;
      return result as QueryResult<R>;
    };
  }
};
