// A value of the root query `q` from a callback, such as `select({ isAlice: (q) => q.where(c).exists() })`,
// applies the conditions that the callback added to `q` to the current record of the root query.
// Query parts that cannot apply to the current record make it throw rather than be dropped.

import { Query } from '../../query';
import { QueryData, QueryScopeData } from '../../query-data';
import { OrchidOrmInternalError } from '../../errors';
import { WhereItem, whereToSql } from '../../basic-features/where/where.sql';
import { FnExpression } from '../../expressions/fn-expression';
import {
  Expression,
  ExpressionData,
  isExpression,
} from '../../expressions/expression';
import { ToSQLCtx } from '../../sql/to-sql';
import { addValue } from '../../../utils';
import { Column } from '../../../columns/column';
import { setWrapRootValueSql } from '../../../columns/operators';

/**
 * Parts of the root query when it was passed to a callback.
 * A part that differs from it was added in the callback, because query methods replace the arrays of query data rather than mutate them.
 */
export interface RootQueryBase {
  and?: WhereItem[];
  or?: WhereItem[][];
  scopes?: QueryData['scopes'];
  join?: QueryData['join'];
  group?: QueryData['group'];
  having?: QueryData['having'];
  union?: QueryData['union'];
  limit?: number;
  offset?: number;
  // what is used, for the error message, when anything added to the root query throws
  strictUsage?: string;
}

interface AddedConditions {
  and?: WhereItem[];
  or?: WhereItem[][];
  scopes?: { [K: string]: QueryScopeData };
}

const unsupportedParts = [
  'join',
  'group',
  'having',
  'union',
  'limit',
  'offset',
] as const;

/**
 * Remembers parts of the root query data `root` in the data `arg` of the callback argument.
 *
 * @param arg - query data of the callback argument
 * @param root - query data of the root query
 * @param strictUsage - what is used, for the error message, when anything added to the root query must throw, even in a value of it
 */
export const setRootQueryBase = (
  arg: QueryData,
  root: QueryData,
  strictUsage?: string,
) => {
  arg.rootBase = {
    and: root.and,
    or: root.or,
    scopes: root.scopes,
    join: root.join,
    group: root.group,
    having: root.having,
    union: root.union,
    limit: root.limit,
    offset: root.offset,
    // a nested callback of a strict root query stays strict
    strictUsage: strictUsage || root.rootBase?.strictUsage,
  };
};

/**
 * Throws when the root query of a callback has conditions or other parts added in the callback.
 * Is used where the added parts have no clear meaning, such as for a relation of the root query.
 *
 * @param query - the root query returned from the callback or derived from it
 * @param usage - what is used, for the error message
 */
export const assertRootQueryUnchanged = (query: Query, usage: string) => {
  const { q } = query;
  const base = q.rootBase;
  if (!base) return;

  if (
    q.and !== base.and ||
    q.or !== base.or ||
    q.scopes !== base.scopes ||
    unsupportedParts.some((key) => q[key] !== base[key])
  ) {
    throw new OrchidOrmInternalError(
      query,
      `Cannot use ${usage} after adding conditions or other query parts to the root query in a callback`,
    );
  }
};

/**
 * Conditions added to the root query in a callback, to apply to the current record of the root query.
 * Throws when the callback added a query part that cannot apply to the current record.
 */
export const getRootValueConditions = (
  query: Query,
): AddedConditions | undefined => {
  const { q } = query;
  const base = q.rootBase;
  if (!base) return;

  if (base.strictUsage) {
    assertRootQueryUnchanged(query, base.strictUsage);
    return;
  }

  for (const key of unsupportedParts) {
    if (q[key] !== base[key]) {
      throw new OrchidOrmInternalError(
        query,
        `Cannot apply \`${key}\` added to the root query in a callback to the value of the current record`,
      );
    }
  }

  const conditions = getAddedConditions(q, base);
  if (!conditions) return;

  const { expr } = q;
  // an aggregate method without `over` throws: its `filter` option applies conditions to the aggregated records,
  // an arbitrary SQL function called with `fn` is not known to be an aggregate
  if (expr instanceof FnExpression && !expr.custom && !expr.options.over) {
    throw new OrchidOrmInternalError(
      query,
      `Cannot apply conditions added to the root query in a callback to the aggregate \`${expr.fn}\`, use its \`filter\` option instead`,
    );
  }

  return conditions;
};

/**
 * Throws when the root query of a callback has conditions added in the callback, or other parts that cannot apply to the current record.
 * Is used for a column reference such as `ref`, which can be used in SQL and as an argument of a function:
 * it cannot represent a record that doesn't match the conditions while keeping the type of its column.
 *
 * @param query - the root query to reference a column of
 * @param usage - the referencing method, for the error message
 */
export const assertNoRootValueConditions = (query: Query, usage: string) => {
  if (getRootValueConditions(query)) {
    throw new OrchidOrmInternalError(
      query,
      `Cannot use ${usage} after adding conditions to the root query in a callback, use \`get\` or \`getOptional\` instead`,
    );
  }
};

const getAddedConditions = (
  q: QueryData,
  base: RootQueryBase,
): AddedConditions | undefined => {
  const scopes = getAddedScopes(q.scopes, base.scopes);

  const { and, or } = q;
  const baseAnd = base.and;
  if (or === base.or) {
    if (and === baseAnd) return scopes && { scopes };

    // the root query conditions already apply to the current record
    if (
      !or &&
      and &&
      baseAnd &&
      and.length > baseAnd.length &&
      baseAnd.every((item, i) => item === and[i])
    ) {
      return { and: and.slice(baseAnd.length), scopes };
    }
  }

  return and || or || scopes ? { and, or, scopes } : undefined;
};

// scopes of the root query already apply to the current record
const getAddedScopes = (
  scopes: QueryData['scopes'],
  baseScopes: QueryData['scopes'],
): AddedConditions['scopes'] => {
  if (scopes === baseScopes) return;

  let added: AddedConditions['scopes'];
  for (const key in scopes) {
    if (scopes[key] !== baseScopes?.[key]) {
      (added ??= {})[key] = scopes[key];
    }
  }
  return added;
};

export interface WrapRootValueSql {
  (ctx: ToSQLCtx, query: Query, sql: string, quotedAs?: string): string;
}

/**
 * Wraps SQL of a value of the root query to apply the conditions added to the root query in a callback,
 * yields the default value of the query, such as `false` for `exists`, when the current record doesn't match them.
 *
 * @param ctx - SQL context
 * @param query - the root query with the value
 * @param sql - SQL of the value
 * @param quotedAs - quoted alias of the root query
 */
export const wrapRootValueSql: WrapRootValueSql = (
  ctx,
  query,
  sql,
  quotedAs,
) => {
  const conditions = getRootValueConditions(query);
  if (!conditions) return sql;

  const { q } = query;
  const data = Object.create(q) as QueryData;
  data.and = conditions.and;
  data.or = conditions.or;
  data.scopes = conditions.scopes;

  const where = whereToSql(ctx, query, data, quotedAs);
  if (!where) return sql;

  const { coalesceValue } = q;
  const otherwise =
    coalesceValue === undefined
      ? ''
      : ` ELSE ${
          isExpression(coalesceValue)
            ? coalesceValue.toSQL(ctx, quotedAs)
            : addValue(ctx.values, coalesceValue)
        }`;

  return `CASE WHEN ${where} THEN ${sql}${otherwise} END`;
};

setWrapRootValueSql(wrapRootValueSql);

/**
 * Expression of a value of the root query that applies the conditions added to the root query in a callback.
 * Is selected instead of the bare expression of the value.
 */
export class RootValueExpression extends Expression {
  result: { value: Column.Pick.QueryColumn };
  // has no operators chain and no `getColumn`: they are applied inside the wrapped SQL
  q: ExpressionData = {};

  constructor(public query: Query) {
    super();
    this.result = (query.q.expr as Expression).result;
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const { q } = this.query;
    let sql = (q.expr as Expression).toSQL(ctx, quotedAs);
    // a nested value is wrapped inside the condition, so that a not matching record is a not found value
    if ((q.getColumn as Column.Pick.Data | undefined)?.data.valueToArray)
      sql = `array[${sql}]`;
    return wrapRootValueSql(ctx, this.query, sql, quotedAs);
  }
}
