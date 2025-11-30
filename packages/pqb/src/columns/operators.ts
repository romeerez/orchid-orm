import {
  PickQueryQ,
  Query,
  SetQueryReturnsColumnOrThrow,
} from '../query/query';
import {
  addValue,
  emptyArray,
  Expression,
  getValueKey,
  isExpression,
  isIterable,
  IsQuery,
  MaybeArray,
  PickQueryColumTypes,
  PickQueryResult,
  PickQueryResultColumnTypes,
  RecordUnknown,
  setObjectValueImmutable,
} from '../core';
import { BooleanQueryColumn } from '../queryMethods';
import { addColumnParserToQuery } from './column.utils';
import { Column } from './column';
import { ToSQLCtx } from '../sql/to-sql';
import { MoveMutativeQueryToCte } from '../query/cte/cte.sql';
import { PrepareSubQueryForSql } from '../query/to-sql/sub-query-for-sql';
import { Db } from '../query';

// workaround for circular dependencies between columns and sql
let moveMutativeQueryToCte: MoveMutativeQueryToCte;
export const setMoveMutativeQueryToCte = (fn: MoveMutativeQueryToCte) => {
  moveMutativeQueryToCte = fn;
};

let prepareSubQueryForSql: PrepareSubQueryForSql;
export const setPrepareSubQueryForSql = (fn: PrepareSubQueryForSql) => {
  prepareSubQueryForSql = fn;
};

let dbClass: typeof Db;
export const setDb = (db: typeof Db) => {
  dbClass = db;
};

/**
 * Function to turn the operator expression into SQL.
 *
 * @param key - SQL of the target to apply operator for, can be a quoted column name or an SQL expression wrapped with parens.
 * @param args - arguments of operator function.
 * @param ctx - context object for SQL conversions, for collecting query variables.
 * @param quotedAs - quoted table name.
 */
export interface OperatorToSQL {
  (key: string, args: [unknown], ctx: unknown, quotedAs?: string): string;
}

// Operator function type.
// Table.count().gt(10) <- here `.gt(10)` is this operator function.
// It discards previously defined column type operators and applies new ones,
// for a case when operator gives a different column type.
export interface Operator<
  Value,
  Column extends Column.Pick.OutputTypeAndOperators = Column.Pick.OutputTypeAndOperators,
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
export function setQueryOperators(query: IsQuery, operators: RecordUnknown) {
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
    function (this: PickQueryQ, value: any) {
      const { q } = this;

      const val = prepareOpArg(this, value);
      (q.chain ??= []).push(_op, val || value);

      // parser might be set by a previous type, but is not needed for boolean
      if (q.parsers?.[getValueKey]) {
        setObjectValueImmutable(q, 'parsers', getValueKey, undefined);
      }

      return setQueryOperators(this as never, boolean as never);
    },
    {
      // function to turn the operator expression into SQL
      _op,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as never;
};

// is different from `make` by `(q.chain ??= []).push(_op, value -> args)`
const makeVarArg = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _op: (key: string, args: any[], ctx: ToSQLCtx, quotedAs?: string) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  return Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (this: PickQueryQ, ...args: any[]) {
      const { q } = this;

      args.forEach((arg, i) => {
        const val = prepareOpArg(this, arg);
        if (val) args[i] = val;
      });

      (q.chain ??= []).push(_op, args);

      // parser might be set by a previous type, but is not needed for boolean
      if (q.parsers?.[getValueKey]) {
        setObjectValueImmutable(q, 'parsers', getValueKey, undefined);
      }

      return setQueryOperators(this as never, boolean as never);
    },
    {
      // function to turn the operator expression into SQL
      _op,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as never;
};

export const prepareOpArg = (q: unknown, arg: unknown) => {
  return arg instanceof dbClass
    ? prepareSubQueryForSql(q as Query, arg as Query)
    : undefined;
};

// Handles array, expression object, query object to insert into sql.
// Saves values to `ctx.values`.
const quoteValue = (
  arg: unknown,
  ctx: ToSQLCtx,
  quotedAs: string | undefined,
  IN?: boolean,
): string => {
  if (arg && typeof arg === 'object') {
    if (IN && isIterable(arg)) {
      return `(${(Array.isArray(arg) ? arg : [...arg])
        .map((value) => addValue(ctx.values, value))
        .join(', ')})`;
    }

    if (isExpression(arg)) {
      return arg.toSQL(ctx, quotedAs);
    }

    if ('toSQL' in arg) {
      return `(${moveMutativeQueryToCte(ctx, arg as never)})`;
    }

    if (!(arg instanceof Date) && !Array.isArray(arg)) {
      arg = JSON.stringify(arg);
    }
  }

  return addValue(ctx.values, arg);
};

const quoteLikeValue = (
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
      return `replace(replace((${moveMutativeQueryToCte(
        ctx,
        arg as never,
      )}), '%', '\\\\%'), '_', '\\\\_')`;
    }
  }

  return addValue(ctx.values, (arg as string).replace(/[%_]/g, '\\$&'));
};

// common operators that exist for any types
interface Base<Value> {
  equals: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  not: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  in: Operator<Value[] | IsQuery | Expression, BooleanQueryColumn>;
  notIn: Operator<Value[] | IsQuery | Expression, BooleanQueryColumn>;
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
      `${key} IN ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
  notIn: make(
    (key, value, ctx, quotedAs) =>
      `NOT ${key} IN ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
};

interface OperatorsBooleanSelf extends OperatorsBoolean {
  result: { value: BooleanQueryColumn };
}

// Numeric, date, and time can be compared with `lt`, `gt`, so it's generic.
interface Ord<Value> extends Base<Value> {
  lt: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  lte: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  gt: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  gte: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  between: Operator<
    [Value | IsQuery | Expression, Value | IsQuery | Expression],
    BooleanQueryColumn
  >;
}

export type OperatorsNumber = Ord<number>;

const ord = {
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

// Boolean type operators
export interface OperatorsBoolean extends Ord<boolean> {
  and: Operator<OperatorsBooleanSelf, BooleanQueryColumn>;
  or: Operator<OperatorsBooleanSelf, BooleanQueryColumn>;
}

const boolean = {
  ...ord,
  and: make(
    (key, value, ctx, quotedAs) =>
      `${key} AND ${value.q.expr.toSQL(ctx, quotedAs)}`,
  ),
  or: make(
    (key, value, ctx, quotedAs) =>
      `(${key}) OR (${value.q.expr.toSQL(ctx, quotedAs)})`,
  ),
} as unknown as OperatorsBoolean;

// Text type operators
export interface OperatorsText extends Base<string> {
  contains: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
  containsSensitive: Operator<
    string | IsQuery | Expression,
    BooleanQueryColumn
  >;
  startsWith: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
  startsWithSensitive: Operator<
    string | IsQuery | Expression,
    BooleanQueryColumn
  >;
  endsWith: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
  endsWithSensitive: Operator<
    string | IsQuery | Expression,
    BooleanQueryColumn
  >;
}

const text = {
  ...base,
  contains: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE '%' || ${quoteLikeValue(value, ctx, quotedAs)} || '%'`,
  ),
  containsSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE '%' || ${quoteLikeValue(value, ctx, quotedAs)} || '%'`,
  ),
  startsWith: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE ${quoteLikeValue(value, ctx, quotedAs)} || '%'`,
  ),
  startsWithSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE ${quoteLikeValue(value, ctx, quotedAs)} || '%'`,
  ),
  endsWith: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE '%' || ${quoteLikeValue(value, ctx, quotedAs)}`,
  ),
  endsWithSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE '%' || ${quoteLikeValue(value, ctx, quotedAs)}`,
  ),
} as OperatorsText;

export interface OperatorsOrdinalText extends Ord<string>, OperatorsText {}

const ordinalText = {
  ...ord,
  ...text,
} as OperatorsOrdinalText;

interface JsonPathQueryOptions {
  vars?: RecordUnknown;
  silent?: boolean;
}

interface JsonPathQueryTypeOptions<
  T extends PickQueryColumTypes,
  C extends Column.Pick.QueryColumn,
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
   * The `type` option sets the output type when selecting a value,
   * also it makes specific operators available in `where`, so that you can apply `contains` if the type is text, and `gt` if the type is numeric.
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
   *
   * // filtering records to contain 'word' in the json property "name"
   * await db.table.where((q) =>
   *   q
   *     .get('data')
   *     .jsonPathQueryFirst('$.name', { type: (t) => t.string() })
   *     .contains('word'),
   * );
   * ```
   *
   * @param path - JSON path
   * @param options - can have type, vars, silent
   */
  <
    T extends PickQueryResultColumnTypes,
    C extends Column.Pick.QueryColumn = Column.Pick.QueryColumnOfTypeAndOps<
      unknown,
      OperatorsAny
    >,
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
export interface OperatorsJson extends Ord<unknown> {
  jsonPathQueryFirst: JsonPathQuery;
  jsonSupersetOf: Operator<unknown | IsQuery | Expression, BooleanQueryColumn>;
  jsonSubsetOf: Operator<unknown | IsQuery | Expression, BooleanQueryColumn>;
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
     *   // supports sql for the value
     *   data: (q) => q.get('data').jsonSet(['path', 'to', 'value'], sql`'new value'`),
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
     *   // supports sql for the value
     *   data: (q) =>
     *     q.get('data').jsonReplace(['path', 'to', 'value'], sql`'new value'`),
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
     *   // supports sql for the value
     *   data: (q) => q.get('data').jsonInsert(['tags', 0], sql`'one'`),
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

const quoteJsonValue = (
  arg: unknown,
  ctx: ToSQLCtx,
  quotedAs: string | undefined,
  IN?: boolean,
): string => {
  if (arg && typeof arg === 'object') {
    if (IN && Array.isArray(arg)) {
      return `(${arg
        .map((value) => addValue(ctx.values, JSON.stringify(value)) + '::jsonb')
        .join(', ')})`;
    }

    if (isExpression(arg)) {
      return 'to_jsonb(' + arg.toSQL(ctx, quotedAs) + ')';
    }

    if ('toSQL' in arg) {
      return `to_jsonb((${moveMutativeQueryToCte(ctx, arg as never)}))`;
    }
  }

  return addValue(ctx.values, JSON.stringify(arg)) + '::jsonb';
};

const serializeJsonValue = (
  arg: unknown,
  ctx: ToSQLCtx,
  quotedAs: string | undefined,
): string => {
  if (arg && typeof arg === 'object') {
    if (isExpression(arg)) {
      return 'to_jsonb(' + arg.toSQL(ctx, quotedAs) + ')';
    }

    if ('toSQL' in arg) {
      return `to_jsonb((${moveMutativeQueryToCte(ctx, arg as never)}))`;
    }
  }

  return addValue(ctx.values, JSON.stringify(arg));
};

const json = {
  ...ord,
  equals: make((key, value, ctx, quotedAs) =>
    value === null
      ? `nullif(${key}, 'null'::jsonb) IS NULL`
      : `${key} = ${quoteJsonValue(value, ctx, quotedAs)}`,
  ),
  not: make((key, value, ctx, quotedAs) =>
    value === null
      ? `nullif(${key}, 'null'::jsonb) IS NOT NULL`
      : `${key} != ${quoteJsonValue(value, ctx, quotedAs)}`,
  ),
  in: make(
    (key, value, ctx, quotedAs) =>
      `${key} IN ${quoteJsonValue(value, ctx, quotedAs, true)}`,
  ),
  notIn: make(
    (key, value, ctx, quotedAs) =>
      `NOT ${key} IN ${quoteJsonValue(value, ctx, quotedAs, true)}`,
  ),
  jsonPathQueryFirst: Object.assign(
    function (
      this: IsQuery,
      path: string,
      options?: JsonPathQueryTypeOptions<
        PickQueryColumTypes,
        Column.Pick.QueryColumn
      >,
    ) {
      const { q, columnTypes } = this as Query;
      const chain = (q.chain ??= []);
      chain.push(jsonPathQueryOp, [path, options]);

      if (q.parsers?.[getValueKey]) {
        setObjectValueImmutable(q, 'parsers', getValueKey, undefined);
      }

      if (options?.type) {
        const type = options.type(columnTypes);
        addColumnParserToQuery(q, getValueKey, type);

        // push the type cast `::type` only if operator is applied
        chain.push = (...args: unknown[]) => {
          chain.push = Array.prototype.push;
          chain.push((s: string) => `${s}::${type.dataType}`, emptyArray);
          return chain.push(...args);
        };

        return setQueryOperators(this, type.operators);
      }

      return this;
    },
    { _op: jsonPathQueryOp },
  ) as never,
  jsonSupersetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} @> ${quoteValue(value, ctx, quotedAs)}`,
  ),
  jsonSubsetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} <@ ${quoteValue(value, ctx, quotedAs)}`,
  ),
  jsonSet: makeVarArg(
    (key, [path, value], ctx, quotedAs) =>
      `jsonb_set(${key}, ${encodeJsonPath(ctx, path)}, ${serializeJsonValue(
        value,
        ctx,
        quotedAs,
      )})`,
  ),
  jsonReplace: makeVarArg(
    (key, [path, value], ctx, quotedAs) =>
      `jsonb_set(${key}, ${encodeJsonPath(ctx, path)}, ${serializeJsonValue(
        value,
        ctx,
        quotedAs,
      )}, false)`,
  ),
  jsonInsert: makeVarArg(
    (key, [path, value, options], ctx, quotedAs) =>
      `jsonb_insert(${key}, ${encodeJsonPath(ctx, path)}, ${serializeJsonValue(
        value,
        ctx,
        quotedAs,
      )}${options?.after ? ', true' : ''})`,
  ),
  jsonRemove: makeVarArg(
    (key, [path], ctx) => `(${key} #- ${encodeJsonPath(ctx, path)})`,
  ),
} as OperatorsJson;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperatorsAny = Base<any>;
export type OperatorsDate = Ord<Date | string>;

export type OperatorsTime = Ord<string>;

export interface OperatorsArray<T> extends Ord<T[]> {
  has: Operator<T | IsQuery | Expression, BooleanQueryColumn>;
  hasEvery: Operator<T[] | IsQuery | Expression, BooleanQueryColumn>;
  hasSome: Operator<T[] | IsQuery | Expression, BooleanQueryColumn>;
  containedIn: Operator<T[] | IsQuery | Expression, BooleanQueryColumn>;
  length: {
    _opType:
      | number
      | { [K in keyof OperatorsNumber]?: OperatorsNumber[K]['_opType'] };
  };
}

const array = {
  ...ord,
  has: make(
    (key, value, ctx, quotedAs) =>
      `${quoteValue(value, ctx, quotedAs)} = ANY(${key})`,
  ),
  hasEvery: make(
    (key, value, ctx, quotedAs) =>
      `${key} @> ${quoteValue(value, ctx, quotedAs)}`,
  ),
  hasSome: make(
    (key, value, ctx, quotedAs) =>
      `${key} && ${quoteValue(value, ctx, quotedAs)}`,
  ),
  containedIn: make(
    (key, value, ctx, quotedAs) =>
      `${key} <@ ${quoteValue(value, ctx, quotedAs)}`,
  ),
  length: make((key, value, ctx, quotedAs) => {
    const expr = `COALESCE(array_length(${key}, 1), 0)`;
    return typeof value === 'number'
      ? `${expr} = ${quoteValue(value, ctx, quotedAs)}`
      : Object.keys(value)
          .map((key) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (ord as any)[key]._op(expr, value[key], ctx, quotedAs),
          )
          .join(' AND ');
  }),
} as OperatorsArray<unknown>;

// `Operators` has operators grouped by types. To be used by column classes.
export const Operators: {
  any: OperatorsAny;
  ordinalText: OperatorsOrdinalText;
  boolean: OperatorsBoolean;
  number: OperatorsNumber;
  date: OperatorsDate;
  time: OperatorsTime;
  text: OperatorsText;
  json: OperatorsJson;
  array: OperatorsArray<unknown>;
} = {
  any: base,
  boolean,
  ordinalText,
  number: ord,
  date: ord,
  time: ord,
  text,
  json,
  array,
} as never;
