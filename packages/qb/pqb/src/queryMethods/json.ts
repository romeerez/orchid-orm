import {
  AddQuerySelect,
  Query,
  queryTypeWithLimitOne,
  SetQueryReturnsValueOptional,
} from '../query';
import { pushQueryValue } from '../queryDataUtils';
import { ColumnType, StringColumn } from '../columns';
import { JsonItem } from '../sql';
import { raw } from '../raw';
import { StringKey } from '../utils';

type JsonColumnName<T extends Pick<Query, 'selectable'>> = StringKey<
  {
    [K in keyof T['selectable']]: T['selectable'][K]['column']['dataType'] extends 'jsonb'
      ? K
      : never;
  }[keyof T['selectable']]
>;

type ColumnOrJsonMethod<T extends Query> = JsonColumnName<T> | JsonItem;

type JsonSetResult<
  T extends Query,
  Column extends ColumnOrJsonMethod<T>,
  As extends string,
  Type extends ColumnType = Column extends keyof T['shape']
    ? T['shape'][Column]
    : Column extends JsonItem
    ? Column['__json'][2]
    : ColumnType,
> = JsonItem<As, Type> &
  (Type extends ColumnType ? AddQuerySelect<T, Record<As, Type>> : T);

type JsonPathQueryResult<
  T extends Query,
  As extends string,
  Type extends ColumnType,
> = JsonItem &
  AddQuerySelect<
    T,
    {
      [K in As]: Type;
    }
  >;

export class Json {
  json<T extends Query>(
    this: T,
  ): SetQueryReturnsValueOptional<T, StringColumn> {
    return this.clone()._json();
  }

  _json<T extends Query>(
    this: T,
  ): SetQueryReturnsValueOptional<T, StringColumn> {
    const q = this._wrap(this.baseQuery.clone()) as T;
    q._getOptional(
      raw(
        queryTypeWithLimitOne[this.query.returnType]
          ? `row_to_json("t".*)`
          : `COALESCE(json_agg(row_to_json("t".*)), '[]')`,
      ),
    );
    return q as unknown as SetQueryReturnsValueOptional<T, StringColumn>;
  }

  jsonSet<
    T extends Query,
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
    T extends Query,
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
          ? this.shape[column]
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

  jsonInsert<
    T extends Query,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    ...args: [
      column: Column,
      path: Array<string | number>,
      value: unknown,
      options?: {
        as?: As;
        insertAfter?: boolean;
      },
    ]
  ): JsonSetResult<T, Column, As> {
    const q = this.clone() as T;
    return q._jsonInsert(...args);
  }

  _jsonInsert<
    T extends Query,
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
          ? this.shape[column]
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

  jsonRemove<
    T extends Query,
    Column extends ColumnOrJsonMethod<T>,
    As extends string = Column extends JsonItem ? Column['__json'][1] : Column,
  >(
    this: T,
    ...args: [
      column: Column,
      path: Array<string | number>,
      options?: { as?: As },
    ]
  ): JsonSetResult<T, Column, As> {
    const q = this.clone() as T;
    return q._jsonRemove(...args);
  }

  _jsonRemove<
    T extends Query,
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
          ? this.shape[column]
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

  jsonPathQuery<T extends Query, As extends string, Type extends ColumnType>(
    this: T,
    ...args: [
      type: Type,
      column: ColumnOrJsonMethod<T>,
      path: string,
      as: As,
      options?: {
        vars?: string;
        silent?: boolean;
      },
    ]
  ): JsonPathQueryResult<T, As, Type> {
    const q = this.clone() as T;
    return q._jsonPathQuery(...args);
  }

  _jsonPathQuery<T extends Query, As extends string, Type extends ColumnType>(
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
