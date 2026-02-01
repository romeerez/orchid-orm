import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData, QueryDataFromItem } from '../../query-data';
import { moveMutativeQueryToCte } from '../cte/cte.sql';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { isExpression } from '../../expressions/expression';
import { getQueryAs } from '../as/as';
import { searchSourcesToSql } from '../../extra-features/search/search.sql';
import { quoteFromWithSchema, quoteTableWithSchema } from '../../sql/sql';
import { checkIfASimpleQuery } from '../../sql/check-if-a-simple-query';

let fromQuery: SubQueryForSql | undefined;

export const pushFromAndAs = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  data: QueryData,
  quotedAs?: string,
): SubQueryForSql | undefined => {
  let sql = 'FROM ';

  const from = getFrom(ctx, query, data, quotedAs);
  sql += from;

  if (data.sources) {
    sql = searchSourcesToSql(ctx, data, data.sources, sql, quotedAs);
  }

  ctx.sql.push(sql);

  if (fromQuery) {
    const fq = fromQuery;
    fromQuery = undefined;
    return fq;
  }
  return;
};

const getFrom = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  data: QueryData,
  quotedAs?: string,
) => {
  fromQuery = undefined;

  if (data.from) {
    const { from } = data;
    if (Array.isArray(from)) {
      return from
        .map((item) => fromToSql(ctx, query, data, item, quotedAs))
        .join(', ');
    }

    return fromToSql(ctx, query, data, from, quotedAs);
  }

  let sql = quoteTableWithSchema(query);

  if (data.as && query.table !== data.as) {
    sql += ` ${quotedAs}`;
  }

  if (data.only) sql = `ONLY ${sql}`;

  return sql;
};

const fromToSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  data: QueryData,
  from: QueryDataFromItem,
  quotedAs?: string,
) => {
  let only: boolean | undefined;
  let sql;
  if (typeof from === 'object') {
    if (isExpression(from)) {
      sql = from.toSQL(ctx, quotedAs) + ' ' + quotedAs;
    } else {
      only = from.q.only;

      if (!from.table) {
        sql = `(${moveMutativeQueryToCte(ctx, from)})`;
      }
      // if the query contains more than just schema return (SELECT ...)
      else if (!checkIfASimpleQuery(from)) {
        sql = `(${moveMutativeQueryToCte(ctx, from)}) ${
          quotedAs || `"${getQueryAs(from)}"`
        }`;
      } else {
        sql = quoteTableWithSchema(from);
      }

      fromQuery = from;
    }
  } else {
    sql = quoteFromWithSchema(query.q.schema, from);
  }

  return (only === undefined ? data.only : only) ? `ONLY ${sql}` : sql;
};
