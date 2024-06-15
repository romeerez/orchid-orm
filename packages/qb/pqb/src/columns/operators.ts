import {
  PickQueryBaseQuery,
  PickQueryColumnTypes,
  PickQueryQ,
  PickQueryResultColumnTypes,
  Query,
  SetQueryReturnsColumnOrThrow,
} from '../query/query';
import { ToSQLCtx } from '../sql';
import { getSqlText } from '../sql/utils';
import {
  addValue,
  ColumnTypeBase,
  Expression,
  getValueKey,
  isExpression,
  MaybeArray,
  PickOutputTypeAndOperators,
  PickQueryResult,
  QueryColumn,
  RecordUnknown,
} from 'orchid-core';
import { BooleanQueryColumn } from '../queryMethods';

// Operator function type.
// Table.count().gt(10) <- here `.gt(10)` is this operator function.
// It discards previously defined column type operators and applies new ones,
// for a case when operator gives a different column type.
export interface Operator<
  Value,
  Column extends PickOutputTypeAndOperators = PickOutputTypeAndOperators,
> {
  <T extends PickQueryResult>(this: T, arg: Value):
    | Omit<
        SetQueryReturnsColumnOrThrow<T, Column>,
        keyof T['result']['value']['operators']
      > &
        Column['operators'];
  // argument type of the function
  _opType: Value;
}

// Extend query object with given operator methods, so that user can call `gt` after calling `count`.
// If query already has the same operators, nothing is changed.
// Previously defined operators, if any, are **not** dropped from the query.
export function setQueryOperators(
  query: PickQueryBaseQuery,
  operators: RecordUnknown,
) {
  const q = (query as unknown as PickQueryQ).q;

  if (q.operators !== operators) {
    q.operators = operators;
    Object.assign(query, operators);
  }

  return query;
}

/**
 * Makes operator function that has `_op` property.
 *
 * @param _op - function to turn the operator call into SQL.
 */
const make = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _op: (key: string, args: any, ctx: ToSQLCtx, quotedAs?: string) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  return Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (this: Query, value: any) {
      (this.q.chain ??= []).push(_op, value);

      // parser might be set by a previous type, but is not needed for boolean
      if (this.q.parsers?.[getValueKey]) {
        this.q.parsers[getValueKey] = undefined;
      }

      return setQueryOperators(this, boolean as never);
    },
    {
      // function to turn the operator expression into SQL
      _op,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as never;
};

const makeVarArg = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _op: (key: string, args: any[], ctx: ToSQLCtx, quotedAs?: string) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  return Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (this: Query, ...args: any[]) {
      (this.q.chain ??= []).push(_op, args);

      // parser might be set by a previous type, but is not needed for boolean
      if (this.q.parsers?.[getValueKey]) {
        this.q.parsers[getValueKey] = undefined;
      }

      return setQueryOperators(this, boolean as never);
    },
    {
      // function to turn the operator expression into SQL
      _op,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as never;
};

// Handles array, expression object, query object to insert into sql.
// Saves values to `ctx.values`.
const quoteValue = (
  arg: unknown,
  ctx: ToSQLCtx,
  quotedAs: string | undefined,
  jsonArray?: boolean,
): string => {
  if (arg && typeof arg === 'object') {
    if (!jsonArray && Array.isArray(arg)) {
      return `(${arg.map((value) => addValue(ctx.values, value)).join(', ')})`;
    }

    if (isExpression(arg)) {
      return arg.toSQL(ctx, quotedAs);
    }

    if ('toSQL' in arg) {
      return `(${getSqlText((arg as Query).toSQL({ values: ctx.values }))})`;
    }
  }

  return addValue(ctx.values, arg);
};

// common operators that exist for any types
interface Base<Value> {
  equals: Operator<Value | Query | Expression, BooleanQueryColumn>;
  not: Operator<Value | Query | Expression, BooleanQueryColumn>;
  in: Operator<Value[] | Query | Expression, BooleanQueryColumn>;
  notIn: Operator<Value[] | Query | Expression, BooleanQueryColumn>;
}

const base: Base<unknown> = {
  equals: make((key, value, ctx, quotedAs) =>
    value === null
      ? `${key} IS NULL`
      : `${key} = ${quoteValue(value, ctx, quotedAs)}`,
  ),
  not: make((key, value, ctx, quotedAs) =>
    value === null
      ? `${key} IS NOT NULL`
      : `${key} <> ${quoteValue(value, ctx, quotedAs)}`,
  ),
  in: make(
    (key, value, ctx, quotedAs) =>
      `${key} IN ${quoteValue(value, ctx, quotedAs)}`,
  ),
  notIn: make(
    (key, value, ctx, quotedAs) =>
      `NOT ${key} IN ${quoteValue(value, ctx, quotedAs)}`,
  ),
};

interface OperatorsBooleanSelf extends OperatorsBoolean {
  result: { value: BooleanQueryColumn };
}

// Boolean type operators
export interface OperatorsBoolean extends Base<boolean> {
  and: Operator<OperatorsBooleanSelf, BooleanQueryColumn>;
  or: Operator<OperatorsBooleanSelf, BooleanQueryColumn>;
}

const boolean = {
  ...base,
  and: make(
    (key, value, ctx, quotedAs) =>
      `${key} AND ${value.q.expr.toSQL(ctx, quotedAs)}`,
  ),
  or: make(
    (key, value, ctx, quotedAs) =>
      `(${key}) OR (${value.q.expr.toSQL(ctx, quotedAs)})`,
  ),
} as unknown as OperatorsBoolean;

// Numeric, date, and time can be compared with `lt`, `gt`, so it's generic.
interface Ord<Value> extends Base<Value> {
  lt: Operator<Value | Query | Expression, BooleanQueryColumn>;
  lte: Operator<Value | Query | Expression, BooleanQueryColumn>;
  gt: Operator<Value | Query | Expression, BooleanQueryColumn>;
  gte: Operator<Value | Query | Expression, BooleanQueryColumn>;
  between: Operator<
    [Value | Query | Expression, Value | Query | Expression],
    BooleanQueryColumn
  >;
}

export type OperatorsNumber = Ord<number>;

const numeric = {
  ...base,
  lt: make(
    (key, value, ctx, quotedAs) =>
      `${key} < ${quoteValue(value, ctx, quotedAs)}`,
  ),
  lte: make(
    (key, value, ctx, quotedAs) =>
      `${key} <= ${quoteValue(value, ctx, quotedAs)}`,
  ),
  gt: make(
    (key, value, ctx, quotedAs) =>
      `${key} > ${quoteValue(value, ctx, quotedAs)}`,
  ),
  gte: make(
    (key, value, ctx, quotedAs) =>
      `${key} >= ${quoteValue(value, ctx, quotedAs)}`,
  ),
  between: make(
    (key, [from, to], ctx, quotedAs) =>
      `${key} BETWEEN ${quoteValue(from, ctx, quotedAs)} AND ${quoteValue(
        to,
        ctx,
        quotedAs,
      )}`,
  ),
} as OperatorsNumber;

// Text type operators
export interface OperatorsText extends Base<string> {
  contains: Operator<string | Query | Expression, BooleanQueryColumn>;
  containsSensitive: Operator<string | Query | Expression, BooleanQueryColumn>;
  startsWith: Operator<string | Query | Expression, BooleanQueryColumn>;
  startsWithSensitive: Operator<
    string | Query | Expression,
    BooleanQueryColumn
  >;
  endsWith: Operator<string | Query | Expression, BooleanQueryColumn>;
  endsWithSensitive: Operator<string | Query | Expression, BooleanQueryColumn>;
}

const text = {
  ...base,
  contains: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE '%' || ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  containsSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE '%' || ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  startsWith: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  startsWithSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  endsWith: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE '%' || ${quoteValue(value, ctx, quotedAs)}`,
  ),
  endsWithSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE '%' || ${quoteValue(value, ctx, quotedAs)}`,
  ),
} as OperatorsText;

interface JsonPathQueryOptions {
  vars?: RecordUnknown;
  silent?: boolean;
}

interface JsonPathQueryTypeOptions<
  T extends PickQueryColumnTypes,
  C extends QueryColumn,
> extends JsonPathQueryOptions {
  type?: (types: T['columnTypes']) => C;
}

interface JsonPathQuery {
  /**
   * Selects a value from JSON data using a JSON path.
   *
   * Calls the [jsonb_path_query_first](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.
   *
   * Type can be provided via `{ type: (t) => t.columnType() }` options, by default the type is `unknown`.
   *
   * Optionally takes `vars` and `silent` parameters, see [Postgres docs](https://www.postgresql.org/docs/current/functions-json.html) for details.
   *
   * ```ts
   * // query a single value from a JSON data,
   * // because of the provided type, string JSON value will be parsed to a Date object.
   * const value = await db.table
   *   .get('data')
   *   .jsonPathQueryFirst('$.path.to.date', { type: (t) => t.date().asDate() });
   *
   * // using it in a select
   * const records = await db.table.select({
   *   date: (q) =>
   *     q.get('data').jsonPathQueryFirst('$[*] ? (@ = key)', {
   *       type: (t) => t.integer(),
   *       // defining `vars` and `silent`
   *       vars: { key: 'key' },
   *       silent: true,
   *     }),
   * });
   *
   * // using it in `where`
   * const filtered = await db.table.where((q) =>
   *   // filtering records by the `name` property from the `data` JSON column
   *   q.get('data').jsonPathQueryFirst('$.name').equals('name'),
   * );
   *
   * // using it in update
   * await db.table.find(id).update({
   *   // using data property to set the `name` column
   *   name: (q) =>
   *     q.get('data').jsonPathQueryFirst('$.name', { type: (t) => t.string() }),
   * });
   * ```
   *
   * @param path - JSON path
   * @param options - can have type, vars, silent
   */
  <
    T extends PickQueryResultColumnTypes,
    C extends QueryColumn = QueryColumn<unknown, OperatorsAny>,
  >(
    this: T,
    path: string,
    options?: JsonPathQueryTypeOptions<T, C>,
  ): Omit<
    SetQueryReturnsColumnOrThrow<T, C>,
    keyof T['result']['value']['operators']
  > &
    C['operators'];

  // disallow it from `where`
  _opType: never;
}

// JSON type operators
export interface OperatorsJson extends Base<unknown> {
  jsonPathQueryFirst: JsonPathQuery;
  jsonSupersetOf: Operator<unknown | Query | Expression, BooleanQueryColumn>;
  jsonSubsetOf: Operator<unknown | Query | Expression, BooleanQueryColumn>;
  jsonSet: {
    /**
     * Returns a JSON value/object/array where a given value is set at the given path.
     * The path is a key or an array of keys to access the value.
     *
     * Calls the [jsonb_set](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.
     *
     * It can be used in all contexts on a single JSON value.
     *
     * ```ts
     * await db.table.find(id).update({
     *   data: (q) => q.get('data').jsonSet(['path', 'to', 'value'], 'new value'),
     * });
     * ```
     *
     * @param path - key or array of keys
     * @param value - value to set
     */
    <T extends PickQueryResult>(
      this: T,
      path: MaybeArray<string | number>,
      value: unknown,
    ): T;
    // disallow it from `where`
    _opType: never;
  };
  jsonReplace: {
    /**
     * The same as {@link jsonSet}, but sets the last argument of `jsonb_set` to false,
     * so this function only has effect when the value already existed in the JSON.
     *
     * ```ts
     * await db.table.find(id).update({
     *   // data.path.to.value will be updated only if it already was defined
     *   data: (q) => q.get('data').jsonReplace(['path', 'to', 'value'], 'new value'),
     * });
     * ```
     *
     * @param path - key or array of keys
     * @param value - value to set
     */
    <T extends PickQueryResult>(
      this: T,
      path: MaybeArray<string | number>,
      value: unknown,
    ): T;
    // disallow it from `where`
    _opType: never;
  };
  jsonInsert: {
    /**
     * Inserts a value into a given position of JSON array and returns the whole array.
     * The path is a key or an array of keys to access the value.
     *
     * If a value exists at the given path, the value is not replaced.
     *
     * Provide `{ after: true }` option to insert a value after a given position.
     *
     * Calls the [jsonb_insert](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.
     *
     * It can be used in all contexts on a single JSON value.
     *
     * ```ts
     * // update the record with data { tags: ['two'] } to have data { tags: ['one', 'two'] }
     * await db.table.find(id).update({
     *   data: (q) => q.get('data').jsonInsert(['tags', 0], 'one'),
     * });
     *
     * // add 'three' after 'two'
     * await db.table.find(id).update({
     *   data: (q) => q.get('data').jsonInsert(['tags', 1], 'three', { after: true }),
     * });
     * ```
     *
     * @param path - key or array of keys
     * @param value - value to insert
     * @param options - can have `after: true`
     */
    <T extends PickQueryResult>(
      this: T,
      path: MaybeArray<string | number>,
      value: unknown,
      options?: { after?: boolean },
    ): T;
    // disallow it from `where`
    _opType: never;
  };
  jsonRemove: {
    /**
     * Remove a value from a JSON object or array at a given path.
     * The path is a key or an array of keys to access the value.
     *
     * Uses the [#-](https://www.postgresql.org/docs/current/functions-json.html) Postgres operator.
     *
     * It can be used in all contexts on a single JSON value.
     *
     * ```ts
     * // the record has data { tags: ['one', 'two'] }
     * // removing the first tag, the data will be { tags: ['two'] }
     * const result = await db.table.find(id).update({
     *   data: (q) => q.get('data').jsonRemove(['tags', 0]),
     * });
     * ```
     *
     * @param path - key or array of keys
     */
    <T extends PickQueryResult>(this: T, path: MaybeArray<string | number>): T;
    // disallow it from `where`
    _opType: never;
  };
}

const encodeJsonPath = (ctx: ToSQLCtx, path: MaybeArray<string | number>) =>
  addValue(ctx.values, `{${Array.isArray(path) ? path.join(', ') : path}}`);

const jsonPathQueryOp = (
  key: string,
  [path, options]: [path: string, options?: JsonPathQueryOptions],
  ctx: ToSQLCtx,
) =>
  `jsonb_path_query_first(${key}, ${addValue(ctx.values, path)}${
    options?.vars
      ? `, ${addValue(ctx.values, JSON.stringify(options.vars))}${
          options.silent ? ', true' : ''
        }`
      : options?.silent
      ? ', NULL, true'
      : ''
  })`;

const json = {
  ...base,
  jsonPathQueryFirst: Object.assign(
    function (
      this: Query,
      path: string,
      options?: JsonPathQueryTypeOptions<PickQueryColumnTypes, ColumnTypeBase>,
    ) {
      (this.q.chain ??= []).push(jsonPathQueryOp, [path, options]);

      if (this.q.parsers?.[getValueKey]) {
        this.q.parsers[getValueKey] = undefined;
      }

      if (options?.type) {
        const parse = options.type(this.columnTypes).parseFn;
        if (parse) (this.q.parsers ??= {})[getValueKey] = parse;
      }

      return this;
    },
    { _op: jsonPathQueryOp },
  ) as never,
  jsonSupersetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} @> ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
  jsonSubsetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} <@ ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
  jsonSet: makeVarArg(
    (key, [path, value], ctx) =>
      `jsonb_set(${key}, ${encodeJsonPath(ctx, path)}, ${addValue(
        ctx.values,
        JSON.stringify(value),
      )})`,
  ),
  jsonReplace: makeVarArg(
    (key, [path, value], ctx) =>
      `jsonb_set(${key}, ${encodeJsonPath(ctx, path)}, ${addValue(
        ctx.values,
        JSON.stringify(value),
      )}, false)`,
  ),
  jsonInsert: makeVarArg(
    (key, [path, value, options], ctx) =>
      `jsonb_insert(${key}, ${encodeJsonPath(ctx, path)}, ${addValue(
        ctx.values,
        JSON.stringify(value),
      )}${options?.after ? ', true' : ''})`,
  ),
  jsonRemove: makeVarArg(
    (key, [path], ctx) => `(${key} #- ${encodeJsonPath(ctx, path)})`,
  ),
} as OperatorsJson;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperatorsAny = Base<any>;
export type OperatorsDate = Ord<Date | string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperatorsArray = Base<any>;

export type OperatorsTime = Ord<string>;

// `Operators` has operators grouped by types. To be used by column classes.
export const Operators: {
  any: OperatorsAny;
  boolean: OperatorsBoolean;
  number: OperatorsNumber;
  date: OperatorsDate;
  time: OperatorsTime;
  text: OperatorsText;
  json: OperatorsJson;
  array: OperatorsArray;
} = {
  any: base,
  boolean,
  number: numeric,
  date: numeric,
  time: numeric,
  text,
  json,
  array: base,
} as never;
