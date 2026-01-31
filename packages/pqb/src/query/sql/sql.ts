import {
  HasCteHooks,
  HasTableHook,
} from '../basic-features/select/hook-select';
import { DelayedRelationSelect } from '../basic-features/select/delayed-relational-select';
import { QueryResult } from '../../adapters/adapter';
import { DbSqlMethod } from '../db';
import { Column } from '../../columns';
import { ToSQLCtx } from './to-sql';
import { QueryType } from '../query-data';
import { wrapMainQueryInCte } from './wrap-main-query-in-cte';

export interface SqlCommonOptions extends HasTableHook, HasCteHooks {
  delayedRelationSelect?: DelayedRelationSelect;
}

export interface SingleSqlItem {
  // SQL string
  text: string;
  // bind values passed along with SQL string
  values?: unknown[];
  runAfterQuery?: RunAfterQuery;
}

// is executed immediately after querying SQL.
// `then` early returns its result if `runAfterQuery` returns a result.
export interface RunAfterQuery {
  (queryResult: QueryResult): void | Promise<{ result: unknown }>;
}

export interface SingleSql extends SingleSqlItem, SqlCommonOptions {}

export interface BatchSql extends SqlCommonOptions {
  // batch of sql queries, is used when there is too many binding params for insert
  batch: SingleSql[];
}

// Output type of the `toSQL` method of query objects.
// This will be passed to database adapter to perform query.
export type Sql = SingleSql | BatchSql;

export const makeSql = (
  ctx: ToSQLCtx,
  type: QueryType,
  isSubSql: boolean | undefined,
  runAfterQuery?: RunAfterQuery,
): SingleSql => {
  if (
    (!isSubSql &&
      // require type to exclude SELECT because it does not require wrapping in CTE for UNION
      type &&
      // exclude insert because insert handles this logic on its own, since it has to deal with batches
      type !== 'insert' &&
      // exclude upsert because it upsert is SELECT from a union, select doesn't require wrapping
      type !== 'upsert' &&
      ctx.topCtx.cteHooks) ||
    ctx.q.appendQueries
  ) {
    wrapMainQueryInCte(ctx, ctx.q, isSubSql);
  }

  return {
    text: ctx.sql.join(' '),
    values: ctx.values,
    runAfterQuery,
  };
};

export const quoteSchemaAndTable = (
  schema: string | undefined,
  table: string,
): string => {
  return schema ? `"${schema}"."${table}"` : `"${table}"`;
};

export const makeRowToJson = (
  table: string,
  shape: Column.Shape.Data,
  aliasName: boolean,
  includingExplicitSelect?: boolean,
): string => {
  let isSimple = true;
  const list: string[] = [];

  for (const key in shape) {
    const column = shape[key];
    if (!includingExplicitSelect && column.data.explicitSelect) {
      continue;
    }

    if ((aliasName && column.data.name) || column.data.jsonCast) {
      isSimple = false;
    }

    list.push(
      `'${key}', "${table}"."${(aliasName && column.data.name) || key}"${
        column.data.jsonCast ? `::${column.data.jsonCast}` : ''
      }`,
    );
  }

  return isSimple
    ? `row_to_json("${table}".*)`
    : `CASE WHEN to_jsonb("${table}") IS NULL THEN NULL ELSE json_build_object(` +
        list.join(', ') +
        ') END';
};

export const getSqlText = (sql: Sql) => {
  if ('text' in sql) return sql.text;
  throw new Error(`Batch SQL is not supported in this query`);
};

export interface QuerySql<ColumnTypes> {
  sql: DbSqlMethod<ColumnTypes>;
}
