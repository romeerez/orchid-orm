import {
  AddQuerySelect,
  Query,
  queryTypeWithLimitOne,
  SetQueryReturnsColumnOptional,
} from '../query';
import { pushQueryValue } from '../queryDataUtils';
import { ColumnType, StringColumn } from '../columns';
import { JsonItem, SelectQueryData } from '../sql';
import { StringKey, ColumnTypeBase } from 'orchid-core';
import { QueryBase } from '../queryBase';
import { RawSQL } from '../sql/rawSql';

// union of column names that have a `jsonb` type
type JsonColumnName<T extends QueryBase> = StringKey<
  {
    [K in keyof T['selectable']]: T['selectable'][K]['column']['dataType'] extends 'jsonb'
      ? K
      : never;
  }[keyof T['selectable']]
>;

// union of `jsonb` column names, or a JsonItem type for nesting json methods one in other
type ColumnOrJsonMethod<T extends QueryBase> = JsonColumnName<T> | JsonItem;

// result of `jsonSet`:
// adds a select to a query,
// adds a `JsonItem` properties that allows nesting of json methods
type JsonSetResult<
  T extends QueryBase,
  Column extends ColumnOrJsonMethod<T>,
  As extends string,
  Type extends ColumnTypeBase = Column extends keyof T['shape']
    ? T['shape'][Column]
    : Column extends JsonItem
    ? Column['__json'][2]
    : ColumnTypeBase,
> = JsonItem<As, Type> & AddQuerySelect<T, Record<As, Type>>;

// result of `jsonPathQuery`:
// adds a select to a query,
// adds a `JsonItem` properties that allows nesting of json methods
type JsonPathQueryResult<
  T extends QueryBase,
  As extends string,
  Type extends ColumnType,
> = JsonItem &
  AddQuerySelect<
    T,
    {
      [K in As]: Type;
    }
  >;

export abstract class JsonModifiers extends QueryBase {
  /**
   * Return a JSON value/object/array where a given value is set at the given path.
   * The path is an array of keys to access the value.
   *
   * Can be used in `update` callback.
   *
   * ```ts
   * const result = await db.table.jsonSet('data', ['name'], 'new value').take();
   *
   * expect(result.data).toEqual({ name: 'new value' });
   * ```
   *
   * Optionally takes parameters of type `{ as?: string, createIfMissing?: boolean }`
   *
   * ```ts
   * await db.table.jsonSet('data', ['name'], 'new value', {
   *   as: 'alias', // select data as `alias`
   *   createIfMissing: true, // ignored if missing by default
   * });
   * ```
   *
   * @param column - name of JSON column, or a result of a nested json method
   * @param path - path to value inside the json
   * @param value - value to set into the json
   * @param options - `as` to alias the json value when selecting, `createIfMissing: true` will create a new JSON property if it didn't exist before
   */
  jsonSet<
    T extends JsonModifiers,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    column: Column,
    path: Array<string | number>,
    value: unknown,
    options?: {
      as?: As;
      createIfMissing?: boolean;
    },
  ): JsonSetResult<T, Column, As> {
    const q = this.clone() as T;
    return q._jsonSet(column, path, value, options);
  }
  _jsonSet<
    T extends JsonModifiers,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    column: Column,
    path: Array<string | number>,
    value: unknown,
    options?: {
      as?: As;
      createIfMissing?: boolean;
    },
  ): JsonSetResult<T, Column, As> {
    const json: JsonItem = {
      __json: [
        'set',
        options?.as ??
          (typeof column === 'string'
            ? column
            : (column as JsonItem).__json[1]),
        typeof column === 'string'
          ? this.query.shape[column]
          : (column as JsonItem).__json[2],
        column,
        path,
        value,
        options,
      ],
    };

    return Object.assign(
      pushQueryValue(this, 'select', json),
      json,
    ) as unknown as JsonSetResult<T, Column, As>;
  }

  /**
   * Return a JSON value/object/array where a given value is inserted at the given JSON path. Value can be a single value or JSON object. If a value exists at the given path, the value is not replaced.
   *
   * Can be used in `update` callback.
   *
   * ```ts
   * // imagine user has data = { tags: ['two'] }
   * const result = await db.table.jsonInsert('data', ['tags', 0], 'one').take();
   *
   * // 'one' is inserted to 0 position
   * expect(result.data).toEqual({ tags: ['one', 'two'] });
   * ```
   *
   * Optionally takes parameters of type `{ as?: string, insertAfter?: boolean }`
   *
   * ```ts
   * // imagine user has data = { tags: ['one'] }
   * const result = await db.table
   *   .jsonInsert('data', ['tags', 0], 'two', {
   *     as: 'alias', // select as an alias
   *     insertAfter: true, // insert after the specified position
   *   })
   *   .take();
   *
   * // 'one' is inserted to 0 position
   * expect(result.alias).toEqual({ tags: ['one', 'two'] });
   * ```
   * @param column - name of JSON column, or a result of a nested json method
   * @param path - path to the array inside the json, last path element is index to insert into
   * @param value - value to insert into the json array
   * @param options - `as` to alias the json value when selecting, `insertAfter: true` to insert after the specified position
   */
  jsonInsert<
    T extends JsonModifiers,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    column: Column,
    path: Array<string | number>,
    value: unknown,
    options?: {
      as?: As;
      insertAfter?: boolean;
    },
  ): JsonSetResult<T, Column, As> {
    const q = this.clone() as T;
    return q._jsonInsert(column, path, value, options);
  }
  _jsonInsert<
    T extends JsonModifiers,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    column: Column,
    path: Array<string | number>,
    value: unknown,
    options?: {
      as?: As;
      insertAfter?: boolean;
    },
  ): JsonSetResult<T, Column, As> {
    const json: JsonItem = {
      __json: [
        'insert',
        options?.as ??
          (typeof column === 'string'
            ? column
            : (column as JsonItem).__json[1]),
        typeof column === 'string'
          ? this.query.shape[column]
          : (column as JsonItem).__json[2],
        column,
        path,
        value,
        options,
      ],
    };

    return Object.assign(
      pushQueryValue(this, 'select', json),
      json,
    ) as unknown as JsonSetResult<T, Column, As>;
  }

  /**
   * Return a JSON value/object/array where a given value is removed at the given JSON path.
   *
   * Can be used in `update` callback.
   *
   * ```ts
   * // imagine a user has data = { tags: ['one', 'two'] }
   * const result = await db.table
   *   .jsonRemove(
   *     'data',
   *     ['tags', 0],
   *     // optional parameters:
   *     {
   *       as: 'alias', // select as an alias
   *     },
   *   )
   *   .take();
   *
   * expect(result.alias).toEqual({ tags: ['two'] });
   * ```
   *
   * @param column - name of JSON column, or a result of a nested json method
   * @param path - path to the array inside the json, last path element is index to remove this element
   * @param options - `as` to alias the json value when selecting
   */
  jsonRemove<
    T extends JsonModifiers,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    column: Column,
    path: Array<string | number>,
    options?: { as?: As },
  ): JsonSetResult<T, Column, As> {
    const q = this.clone() as T;
    return q._jsonRemove(column, path, options);
  }
  _jsonRemove<
    T extends JsonModifiers,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    column: Column,
    path: Array<string | number>,
    options?: { as?: As },
  ): JsonSetResult<T, Column, As> {
    const json: JsonItem = {
      __json: [
        'remove',
        options?.as ??
          (typeof column === 'string'
            ? column
            : (column as JsonItem).__json[1]),
        typeof column === 'string'
          ? this.query.shape[column]
          : (column as JsonItem).__json[2],
        column,
        path,
      ],
    };

    return Object.assign(
      pushQueryValue(this, 'select', json),
      json,
    ) as unknown as JsonSetResult<T, Column, As>;
  }

  /**
   * Selects a value from JSON data using a JSON path.
   *
   * ```ts
   * import { columnTypes } from 'pqb';
   *
   * db.table.jsonPathQuery(
   *   columnTypes.text(3, 100), // type of the value
   *   'data', // name of the JSON column
   *   '$.name', // JSON path
   *   'name', // select value as name
   *
   *   // Optionally supports `vars` and `silent` options
   *   // check Postgres docs for jsonb_path_query for details
   *   {
   *     vars: 'vars',
   *     silent: true,
   *   },
   * );
   * ```
   *
   * Nested JSON operations can be used in place of JSON column name:
   *
   * ```ts
   * db.table.jsonPathQuery(
   *   columnTypes.text(3, 100),
   *   // Available: .jsonSet, .jsonInsert, .jsonRemove
   *   db.table.jsonSet('data', ['key'], 'value'),
   *   '$.name',
   *   'name',
   * );
   * ```
   *
   * @param type - provide a column type to have a correct result type
   * @param column - name of JSON column, or a result of a nested json method
   * @param path - special JSON path string to reference a JSON value
   * @param as - optional alias for the selected value
   * @param options - supports `vars` and `silent`, check Postgres docs of `json_path_query` for these
   */
  jsonPathQuery<
    T extends JsonModifiers,
    As extends string,
    Type extends ColumnType,
  >(
    this: T,
    type: Type,
    column: ColumnOrJsonMethod<T>,
    path: string,
    as: As,
    options?: {
      vars?: string;
      silent?: boolean;
    },
  ): JsonPathQueryResult<T, As, Type> {
    const q = this.clone() as T;
    return q._jsonPathQuery(type, column, path, as, options);
  }
  _jsonPathQuery<
    T extends JsonModifiers,
    As extends string,
    Type extends ColumnType,
  >(
    this: T,
    type: Type,
    column: ColumnOrJsonMethod<T>,
    path: string,
    as: As,
    options?: {
      vars?: string;
      silent?: boolean;
    },
  ): JsonPathQueryResult<T, As, Type> {
    const json: JsonItem = {
      __json: ['pathQuery', as, type, column, path, options],
    };

    return Object.assign(
      pushQueryValue(this, 'select', json),
      json,
    ) as unknown as JsonPathQueryResult<T, As, Type>;
  }
}

export abstract class JsonMethods {
  /**
   * Wraps the query in a way to select a single JSON string.
   * So that JSON encoding is done on a database side, and the application doesn't have to turn a response to a JSON.
   * It may be better for performance in some cases.
   *
   * ```ts
   * // json is a JSON string that you can directly send as a response.
   * const json = await db.table.select('id', 'name').json();
   * ```
   *
   * @param coalesce
   */
  json<T extends Query>(
    this: T,
    coalesce?: boolean,
  ): SetQueryReturnsColumnOptional<T, StringColumn> {
    return this.clone()._json(coalesce);
  }
  _json<T extends Query>(
    this: T,
    coalesce?: boolean,
  ): SetQueryReturnsColumnOptional<T, StringColumn> {
    const q = this._wrap(this.baseQuery.clone()) as unknown as T;
    // json_agg is used instead of jsonb_agg because it is 2x faster, according to my benchmarks
    q._getOptional(
      new RawSQL(
        queryTypeWithLimitOne[this.query.returnType]
          ? `row_to_json("t".*)`
          : coalesce !== false
          ? `COALESCE(json_agg(row_to_json("t".*)), '[]')`
          : 'json_agg(row_to_json("t".*))',
      ),
    );

    // to skip LIMIT 1
    (q.query as SelectQueryData).returnsOne = true;

    return q as unknown as SetQueryReturnsColumnOptional<T, StringColumn>;
  }
}
