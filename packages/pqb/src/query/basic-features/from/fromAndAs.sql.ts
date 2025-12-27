import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData, QueryDataFromItem } from '../../query-data';
import { IsQuery, Query } from '../../query';
import { moveMutativeQueryToCte } from '../cte/cte.sql';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { isExpression } from '../../expressions/expression';
import { getQueryAs } from '../as/as';
import { searchSourcesToSql } from '../../extra-features/search/search.sql';
import { quoteSchemaAndTable } from '../../sql/sql';
import { checkIfASimpleQuery } from '../../sql/check-if-a-simple-query';

let fromQuery: SubQueryForSql | undefined;

export const pushFromAndAs = (
  ctx: ToSQLCtx,
  table: IsQuery,
  data: QueryData,
  quotedAs?: string,
): SubQueryForSql | undefined => {
  let sql = 'FROM ';

  const from = getFrom(ctx, table, data, quotedAs);
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
  table: IsQuery,
  data: QueryData,
  quotedAs?: string,
) => {
  fromQuery = undefined;

  if (data.from) {
    const { from } = data;
    if (Array.isArray(from)) {
      return from
        .map((item) => fromToSql(ctx, data, item, quotedAs))
        .join(', ');
    }

    return fromToSql(ctx, data, from, quotedAs);
  }

  let sql = quoteSchemaAndTable(data.schema, (table as Query).table as string);

  if (data.as && quotedAs && quotedAs !== sql) {
    sql += ` ${quotedAs}`;
  }

  if (data.only) sql = `ONLY ${sql}`;

  return sql;
};

const fromToSql = (
  ctx: ToSQLCtx,
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
        sql = quoteSchemaAndTable(from.q.schema, from.table);
      }

      fromQuery = from;
    }
  } else {
    sql = quoteSchemaAndTable(data.schema, from);
  }

  return (only === undefined ? data.only : only) ? `ONLY ${sql}` : sql;
};
