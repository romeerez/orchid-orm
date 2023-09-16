import { Query } from '../query/query';
import {
  SimpleJoinItem,
  WhereInItem,
  WhereItem,
  WhereJsonPathEqualsItem,
  WhereOnItem,
  WhereOnJoinItem,
  WhereSearchItem,
} from './types';
import { addValue, columnToSql, simpleColumnToSQL } from './common';
import { getClonedQueryData, getQueryAs } from '../common/utils';
import { processJoinItem } from './join';
import { makeSQL, ToSQLCtx } from './toSQL';
import { JoinedShapes, QueryData } from './data';
import { Expression, isExpression, MaybeArray, toArray } from 'orchid-core';
import { Operator } from '../columns/operators';

export const pushWhereStatementSql = (
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
) => {
  const res = whereToSql(ctx, table, query, quotedAs, false);
  if (res) {
    ctx.sql.push('WHERE', res);
  }
};

export const pushWhereToSql = (
  sql: string[],
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
  not?: boolean,
) => {
  const res = whereToSql(ctx, table, query, quotedAs, not);
  if (res) {
    sql.push(res);
  }
};

export const whereToSql = (
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
  not?: boolean,
): string | undefined => {
  if (query.or) {
    const ors = query.and?.length ? [query.and, ...query.or] : query.or;
    return ors
      .map((and) => processAnds(and, ctx, table, query, quotedAs, not))
      .join(' OR ');
  } else if (query.and) {
    return processAnds(query.and, ctx, table, query, quotedAs, not);
  } else {
    return undefined;
  }
};

const processAnds = (
  and: WhereItem[],
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
  not?: boolean,
): string => {
  const ands: string[] = [];
  for (const data of and) {
    processWhere(ands, ctx, table, query, data, quotedAs, not);
  }
  return ands.join(' AND ');
};

const processWhere = (
  ands: string[],
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes' | 'language'>,
  data: WhereItem,
  quotedAs?: string,
  not?: boolean,
) => {
  const prefix = not ? 'NOT ' : '';

  if (typeof data === 'function') {
    const qb = Object.create(table);
    qb.q = getClonedQueryData(query as QueryData);
    qb.q.and = qb.q.or = undefined;
    qb.q.isSubQuery = true;

    const res = data(qb);
    const expr = res instanceof Expression ? res : res.q.expr;
    if (!(res instanceof Expression) && res.q.expr) {
      const q =
        'relationConfig' in res
          ? res.relationConfig.joinQuery(table, res)
          : res.clone();

      q.q.select = [expr as Expression];
      ands.push(`${prefix}(${makeSQL(q as Query, ctx).text})`);
    } else {
      pushWhereToSql(ands, ctx, res as Query, (res as Query).q, quotedAs, not);
    }

    return;
  }

  if ('prototype' in data || 'baseQuery' in data) {
    const query = data as Query;
    const sql = whereToSql(
      ctx,
      query,
      query.q,
      query.table && `"${query.table}"`,
    );
    if (sql) {
      ands.push(`${prefix}(${sql})`);
    }
    return;
  }

  if (isExpression(data)) {
    ands.push(`${prefix}(${data.toSQL(ctx, quotedAs)})`);
    return;
  }

  for (const key in data) {
    const value = (data as Record<string, unknown>)[key];
    if (value === undefined) continue;

    if (key === 'AND') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      ands.push(processAnds(arr, ctx, table, query, quotedAs, not));
    } else if (key === 'OR') {
      const arr = (value as MaybeArray<WhereItem>[]).map(toArray);
      ands.push(
        arr
          .map((and) => processAnds(and, ctx, table, query, quotedAs, not))
          .join(' OR '),
      );
    } else if (key === 'NOT') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      ands.push(processAnds(arr, ctx, table, query, quotedAs, !not));
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
          `${prefix}jsonb_path_query_first(${leftColumn}, ${addValue(
            ctx.values,
            leftPath,
          )}) = jsonb_path_query_first(${rightColumn}, ${addValue(
            ctx.values,
            rightPath,
          )})`,
        );
      } else {
        const item = value as WhereOnItem;
        const leftColumn = columnToSql(
          ctx,
          query,
          query.shape,
          item.on[0],
          `"${getJoinItemSource(item.joinFrom)}"`,
        );

        const joinTo = getJoinItemSource(item.joinTo);
        const joinedShape = (query.joinedShapes as JoinedShapes)[joinTo];

        let op;
        let rightColumn;
        if (item.on.length === 2) {
          op = '=';
          rightColumn = columnToSql(
            ctx,
            query,
            joinedShape,
            item.on[1],
            `"${joinTo}"`,
          );
        } else {
          op = item.on[1];
          rightColumn = columnToSql(
            ctx,
            query,
            joinedShape,
            item.on[2],
            `"${joinTo}"`,
          );
        }

        ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
      }
    } else if (key === 'IN') {
      toArray(value as MaybeArray<WhereInItem>).forEach((item) => {
        pushIn(ctx, query, ands, prefix, quotedAs, item);
      });
    } else if (key === 'EXISTS') {
      const joinItems = (
        Array.isArray((value as unknown[])[0]) ? value : [value]
      ) as { args: SimpleJoinItem['args']; isSubQuery: boolean }[];

      for (const args of joinItems) {
        const { target, conditions } = processJoinItem(
          ctx,
          table,
          query,
          args,
          quotedAs,
        );

        ands.push(
          `${prefix}EXISTS (SELECT 1 FROM ${target} WHERE ${conditions})`,
        );
      }
    } else if (key === 'SEARCH') {
      const search = value as WhereSearchItem;
      ands.push(`${prefix}${search.vectorSQL} @@ "${search.as}"`);
    } else if (typeof value === 'object' && value && !(value instanceof Date)) {
      if (isExpression(value)) {
        ands.push(
          `${prefix}${columnToSql(
            ctx,
            query,
            query.shape,
            key,
            quotedAs,
          )} = ${value.toSQL(ctx, quotedAs)}`,
        );
      } else {
        let column = query.shape[key];
        let quotedColumn: string | undefined;
        if (column) {
          quotedColumn = simpleColumnToSQL(ctx, key, column, quotedAs);
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
            quotedColumn = undefined;
          }

          if (!column || !quotedColumn) {
            // TODO: custom error classes
            throw new Error(`Unknown column ${key} provided to condition`);
          }
        }

        if (value instanceof ctx.queryBuilder.constructor) {
          ands.push(
            `${prefix}${quotedColumn} = (${(value as Query).toSQL(ctx).text})`,
          );
        } else {
          for (const op in value) {
            const operator = column.operators[op];
            if (!operator) {
              // TODO: custom error classes
              throw new Error(`Unknown operator ${op} provided to condition`);
            }

            if (value[op as keyof typeof value] === undefined) continue;

            ands.push(
              `${prefix}${(operator as unknown as Operator<unknown>)._op(
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
      ands.push(
        `${prefix}${columnToSql(ctx, query, query.shape, key, quotedAs)} ${
          value === null ? 'IS NULL' : `= ${addValue(ctx.values, value)}`
        }`,
      );
    }
  }
};

const getJoinItemSource = (joinItem: WhereOnJoinItem) => {
  return typeof joinItem === 'string' ? joinItem : getQueryAs(joinItem);
};

const pushIn = (
  ctx: ToSQLCtx,
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  ands: string[],
  prefix: string,
  quotedAs: string | undefined,
  arg: {
    columns: string[];
    values: unknown[][] | Query | Expression;
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
    const sql = makeSQL(arg.values, ctx);
    value = `(${sql.text})`;
  }

  const columnsSql = arg.columns
    .map((column) => columnToSql(ctx, query, query.shape, column, quotedAs))
    .join(', ');

  ands.push(
    `${prefix}${multiple ? `(${columnsSql})` : columnsSql} IN ${value}`,
  );
};
