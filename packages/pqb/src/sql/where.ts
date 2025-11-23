import { Query } from '../query/query';
import {
  JoinItemArgs,
  WhereInItem,
  WhereItem,
  WhereJsonPathEqualsItem,
  WhereOnItem,
  WhereOnJoinItem,
  WhereSearchItem,
} from './types';
import {
  columnToSql,
  simpleColumnToSQL,
  simpleExistingColumnToSQL,
} from './common';
import { getQueryAs, joinSubQuery } from '../common/utils';
import { processJoinItem } from './join';
import { toSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import {
  PickQueryDataShapeAndJoinedShapes,
  QueryData,
  QueryScopeData,
} from './data';
import {
  _getQueryOuterAliases,
  addValue,
  ColumnsParsers,
  Expression,
  isExpression,
  IsQuery,
  MaybeArray,
  QueryDataAliases,
  RecordUnknown,
  toArray,
} from '../core';
import { Column } from '../columns/column';
import { getSqlText } from './utils';
import { selectToSql } from './select';
import { OperatorToSQL } from 'pqb';

interface QueryDataForWhere extends QueryDataAliases {
  and?: QueryData['and'];
  or?: QueryData['or'];
  shape: QueryData['shape'];
  joinedShapes?: QueryData['joinedShapes'];
  scopes?: { [K: string]: QueryScopeData };
  outerAliases?: QueryData['outerAliases'];
  parsers?: ColumnsParsers;
}

interface QueryDataWithLanguage extends QueryDataForWhere {
  language?: QueryData['language'];
}

export const pushWhereStatementSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
) => {
  const res = whereToSql(ctx, table, query, quotedAs);
  if (res) {
    ctx.sql.push('WHERE', res);
  }
};

export const pushWhereToSql = (
  sql: string[],
  ctx: ToSQLCtx,
  table: Query,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
) => {
  const res = whereToSql(ctx, table, query, quotedAs, parens);
  if (res) {
    sql.push(res);
  }
};

export const whereToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
): string | undefined => {
  if (query.scopes) {
    let sql = andOrToSql(ctx, table, query, quotedAs, true);

    const data = Object.create(query);
    for (const key in query.scopes) {
      const scope = query.scopes[key];
      data.and = scope.and;
      data.or = scope.or;
      const scopeSql = andOrToSql(ctx, table, data, quotedAs, true);
      if (scopeSql) sql = sql ? sql + ' AND ' + scopeSql : scopeSql;
    }

    return sql;
  }

  return andOrToSql(ctx, table, query, quotedAs, parens);
};

const andOrToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
): string | undefined => {
  let sql;
  if (query.or) {
    const ors = query.and?.length ? [query.and, ...query.or] : query.or;
    sql = ors
      .map((and) => processAnds(and, ctx, table, query, quotedAs))
      .join(' OR ');
  } else if (query.and) {
    sql = processAnds(query.and, ctx, table, query, quotedAs);
  } else {
    return;
  }

  return parens && sql ? `(${sql})` : sql;
};

const processAnds = (
  and: WhereItem[],
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
): string | undefined => {
  const ands: string[] = [];
  for (const data of and) {
    processWhere(ands, ctx, table, query, data, quotedAs);
  }
  if (!ands.length) return;

  const sql = ands.join(' AND ');
  return parens && ands.length > 1 ? `(${sql})` : sql;
};

const processWhere = (
  ands: string[],
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataWithLanguage,
  data: WhereItem,
  quotedAs?: string,
) => {
  if ('prototype' in data || 'baseQuery' in data) {
    const query = data as Query;
    if (query.q.expr) {
      if (query.q.subQuery === 1) {
        ands.push(selectToSql(ctx, table, query.q, quotedAs));
      } else {
        const q = joinSubQuery(table, query);
        q.q.select = [query.q.expr];
        ands.push(`(${getSqlText(toSQL(q as Query, ctx))})`);
      }
    } else {
      pushWhereToSql(
        ands,
        ctx,
        query,
        query.q,
        query.table && `"${query.table}"`,
        true,
      );
    }
    return;
  }

  if (isExpression(data)) {
    ands.push(`(${data.toSQL(ctx, quotedAs)})`);
    return;
  }

  for (const key in data) {
    const value = (data as RecordUnknown)[key];
    if (value === undefined) continue;

    if (key === 'AND') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      const sql = processAnds(arr, ctx, table, query, quotedAs);
      if (sql) ands.push(sql);
    } else if (key === 'OR') {
      const arr = (value as MaybeArray<WhereItem>[]).map(toArray);
      const sqls = arr.reduce<string[]>((acc, and) => {
        const sql = processAnds(and, ctx, table, query, quotedAs);
        if (sql) acc.push(sql);
        return acc;
      }, []);
      if (sqls.length) ands.push(`(${sqls.join(' OR ')})`);
    } else if (key === 'NOT') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      ands.push(`NOT ${processAnds(arr, ctx, table, query, quotedAs, true)}`);
    } else if (key === 'ON') {
      if (Array.isArray(value)) {
        const item = value as WhereJsonPathEqualsItem;
        const leftColumn = columnToSql(
          ctx,
          query,
          query.shape,
          item[0],
          quotedAs,
        );

        const leftPath = item[1];
        const rightColumn = columnToSql(
          ctx,
          query,
          query.shape,
          item[2],
          quotedAs,
        );

        const rightPath = item[3];

        ands.push(
          `jsonb_path_query_first(${leftColumn}, ${addValue(
            ctx.values,
            leftPath,
          )}) = jsonb_path_query_first(${rightColumn}, ${addValue(
            ctx.values,
            rightPath,
          )})`,
        );
      } else {
        const item = value as WhereOnItem;
        const joinAs = `"${getJoinItemSource(item.joinFrom)}"`;

        const q: OnColumnToSQLQuery = item.useOuterAliases
          ? {
              joinedShapes: query.joinedShapes,
              aliases: _getQueryOuterAliases(query),
              shape: query.shape,
            }
          : query;

        ands.push(
          `${onColumnToSql(ctx, q, joinAs, item.from)} ${
            item.op || '='
          } ${onColumnToSql(ctx, q, joinAs, item.to)}`,
        );
      }
    } else if (key === 'IN') {
      toArray(value as MaybeArray<WhereInItem>).forEach((item) => {
        pushIn(ctx, query, ands, quotedAs, item);
      });
    } else if (key === 'EXISTS') {
      const joinItems = (
        Array.isArray((value as unknown[])[0]) ? value : [value]
      ) as JoinItemArgs[];

      const joinSet = joinItems.length > 1 ? new Set<string>() : null;

      for (const args of joinItems) {
        const { target, on } = processJoinItem(
          ctx,
          table,
          query,
          args,
          quotedAs,
        );

        const sql = `EXISTS (SELECT 1 FROM ${target}${
          on ? ` WHERE ${on}` : ''
        })`;
        if (joinSet) {
          if (joinSet.has(sql)) continue;
          joinSet.add(sql);
        }

        ands.push(sql);
      }
    } else if (key === 'SEARCH') {
      const search = value as WhereSearchItem;
      ands.push(`${search.vectorSQL} @@ "${search.as}"`);
    } else if (
      typeof value === 'object' &&
      value &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      if (isExpression(value)) {
        ands.push(
          `${columnToSql(
            ctx,
            query,
            query.shape,
            key,
            quotedAs,
          )} = ${value.toSQL(ctx, quotedAs)}`,
        );
      } else {
        let column: Column.Pick.QueryColumn | undefined = query.shape[key];
        let quotedColumn: string | undefined;
        if (column) {
          quotedColumn = simpleExistingColumnToSQL(ctx, key, column, quotedAs);
        } else if (!column) {
          const index = key.indexOf('.');
          if (index !== -1) {
            const table = key.slice(0, index);
            const quoted = `"${table}"`;
            const name = key.slice(index + 1);

            column = (
              quotedAs === quoted
                ? query.shape[name]
                : query.joinedShapes?.[table]?.[name]
            ) as typeof column;

            quotedColumn = simpleColumnToSQL(ctx, name, column, quoted);
          } else {
            column = query.joinedShapes?.[key]?.value;
            quotedColumn = `"${key}"."${key}"`;
          }

          if (!column || !quotedColumn) {
            throw new Error(`Unknown column ${key} provided to condition`);
          }
        }

        if (value instanceof ctx.qb.constructor) {
          ands.push(
            `${quotedColumn} = (${getSqlText((value as Query).toSQL(ctx))})`,
          );
        } else {
          for (const op in value) {
            const operator = (column.operators as RecordUnknown)[op];
            if (!operator) {
              throw new Error(`Unknown operator ${op} provided to condition`);
            }

            if (value[op as keyof typeof value] === undefined) continue;

            ands.push(
              `${(operator as unknown as { _op: OperatorToSQL })._op(
                quotedColumn as string,
                value[op as keyof typeof value],
                ctx,
                quotedAs,
              )}`,
            );
          }
        }
      }
    } else {
      const column = columnToSql(ctx, query, query.shape, key, quotedAs);
      if (typeof value === 'function') {
        const expr = value(table);
        ands.push(`${column} = ${expr.toSQL(ctx, quotedAs)}`);
      } else {
        ands.push(
          `${column} ${
            value === null ? 'IS NULL' : `= ${addValue(ctx.values, value)}`
          }`,
        );
      }
    }
  }
};

interface OnColumnToSQLQuery {
  joinedShapes?: QueryData['joinedShapes'];
  aliases?: QueryData['aliases'];
  shape: Column.QueryColumns;
}

const onColumnToSql = (
  ctx: ToSQLCtx,
  query: OnColumnToSQLQuery,
  joinAs: string,
  column: string,
) => columnToSql(ctx, query, query.shape, column, joinAs);

const getJoinItemSource = (joinItem: WhereOnJoinItem) => {
  return typeof joinItem === 'string' ? joinItem : getQueryAs(joinItem);
};

const pushIn = (
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  ands: string[],
  quotedAs: string | undefined,
  arg: {
    columns: string[];
    values: unknown[][] | IsQuery | Expression;
  },
) => {
  // if there are multiple columns, make `(col1, col2) IN ((1, 2), (3, 4))`,
  // otherwise, make `col IN (1, 2, 3)`
  const multiple = arg.columns.length > 1;

  let value: string;

  if (Array.isArray(arg.values)) {
    value = `${arg.values
      .map(
        multiple
          ? (arr) =>
              `(${arr.map((value) => addValue(ctx.values, value)).join(', ')})`
          : (arr) =>
              `${arr.map((value) => addValue(ctx.values, value)).join(', ')}`,
      )
      .join(', ')}`;

    value = `(${value})`;
  } else if (isExpression(arg.values)) {
    value = arg.values.toSQL(ctx, quotedAs);
  } else {
    value = `(${getSqlText(toSQL(arg.values as never, ctx))})`;
  }

  const columnsSql = arg.columns
    .map((column) => columnToSql(ctx, query, query.shape, column, quotedAs))
    .join(', ');

  ands.push(`${multiple ? `(${columnsSql})` : columnsSql} IN ${value}`);
};
