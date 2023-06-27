import { Query, SetQueryReturnsColumnInfo } from '../query';
import { ColumnInfoQueryData } from '../sql';

// column info pulled from a database
export type ColumnInfo = {
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
const rowToColumnInfo = (row: unknown): ColumnInfo => {
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

export class ColumnInfoMethods {
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
   * // columnInfo has type Record<string, ColumnInfo>, where string is name of columns
   * const columnInfo = await db.table.columnInfo();
   *
   * // singleColumnInfo has the type ColumnInfo
   * const singleColumnInfo = await db.table.columnInfo('name');
   * ```
   *
   * @param column - optional: select info for only a single column if provided, or for all table columns if not
   */
  columnInfo<
    T extends Query,
    Column extends keyof T['shape'] | undefined = undefined,
  >(this: T, column?: Column): SetQueryReturnsColumnInfo<T, Column> {
    return this.clone()._columnInfo(column);
  }
  _columnInfo<
    T extends Query,
    Column extends keyof T['shape'] | undefined = undefined,
  >(this: T, column?: Column): SetQueryReturnsColumnInfo<T, Column> {
    this.q.type = 'columnInfo';
    this.q.returnType = 'all';

    if (column) {
      (this.q as ColumnInfoQueryData).column = column as string;
    }

    this.q.handleResult = (_, _t, result) => {
      if (column) {
        return rowToColumnInfo(result.rows[0]);
      } else {
        const info: Record<string, ColumnInfo> = {};
        result.rows.forEach((row) => {
          info[(row as { column_name: string }).column_name] =
            rowToColumnInfo(row);
        });
        return info;
      }
    };

    return this as unknown as SetQueryReturnsColumnInfo<T, Column>;
  }
}
