import { Column } from '../../../columns';
import { PickQueryShape } from '../../pick-query-types';
import { QueryThenShallowSimplify } from '../../then/then';
import { makeColumnInfoSql } from './get-column-info.sql';
import { ToSQLQuery } from '../../sql/to-sql';
import { _clone, Query } from 'pqb';

/**
 * Result type for `columnInfo` method.
 * Sets query kind to 'columnInfo', returns a single value (may return undefined),
 * the value is a {@link GetColumnInfo} object or a Record with keys for column names and ColumnInfo objects as values.
 **/
export type SetQueryReturnsColumnInfo<
  T extends PickQueryShape,
  Column extends keyof T['shape'] | undefined,
  Result = Column extends keyof T['shape']
    ? GetColumnInfo
    : { [K in keyof T['shape']]: GetColumnInfo },
> =
  // Omit is optimal
  Omit<T, 'result' | 'returnType' | 'then'> & {
    result: { value: Column.Pick.QueryColumnOfType<Result> };
    returnType: 'value';
    then: QueryThenShallowSimplify<Result>;
  };

// column info pulled from a database
export type GetColumnInfo = {
  // default value of a column
  defaultValue: unknown;
  // column type
  type: string;
  // max length for the text types such as varchar
  maxLength: number | null;
  // is column nullable
  nullable: boolean;
};

// map database response for a column into a ColumnInfo
const rowToColumnInfo = (row: unknown): GetColumnInfo => {
  const typed = row as {
    column_default: string | null;
    is_nullable: 'YES' | 'NO';
    data_type: string;
    character_maximum_length: number | null;
  };

  return {
    defaultValue: typed.column_default,
    type: typed.data_type,
    maxLength: typed.character_maximum_length,
    nullable: typed.is_nullable === 'YES',
  };
};

/**
 * Returns an object with the column info about the current table, or an individual column if one is passed, returning an object with the following keys:
 *
 * ```ts
 * type ColumnInfo = {
 *   defaultValue: unknown; // the default value for the column
 *   type: string; // the column type
 *   maxLength: number | null; // the max length set for the column, present on string types
 *   nullable: boolean; // whether the column may be null
 * };
 *
 * import { getColumnInfo } from 'orchid-orm';
 *
 * // columnInfo has type Record<string, ColumnInfo>, where string is name of columns
 * const columnInfo = await getColumnInfo(db.table);
 *
 * // singleColumnInfo has the type ColumnInfo
 * const singleColumnInfo = await getColumnInfo(db.table, 'name');
 * ```
 *
 * @param column - optional: select info for only a single column if provided, or for all table columns if not
 */
export function getColumnInfo<
  T extends PickQueryShape,
  Column extends keyof T['shape'] | undefined = undefined,
>(query: T, column?: Column): SetQueryReturnsColumnInfo<T, Column> {
  const q = Object.create(_clone(query)) as Query;

  q.toSQL = () =>
    makeColumnInfoSql(query as unknown as ToSQLQuery, column as string);

  q.q.handleResult = (_, _t, result) => {
    if (column) {
      return rowToColumnInfo(result.rows[0]);
    } else {
      const info: { [K: string]: GetColumnInfo } = {};
      result.rows.forEach((row) => {
        info[(row as { column_name: string }).column_name] =
          rowToColumnInfo(row);
      });
      return info;
    }
  };

  return q as never;
}
