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
  addValue,
  columnToSql,
  simpleColumnToSQL,
  simpleExistingColumnToSQL,
} from './common';
import {
  getClonedQueryData,
  getQueryAs,
  joinSubQuery,
  resolveSubQueryCallback,
} from '../common/utils';
import { processJoinItem } from './join';
import { makeSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import {
  JoinedShapes,
  PickQueryDataShapeAndJoinedShapes,
  QueryData,
} from './data';
import {
  Expression,
  isExpression,
  MaybeArray,
  RecordUnknown,
  toArray,
} from 'orchid-core';
import { BaseOperators, Operator } from '../columns/operators';

export const pushWhereStatementSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
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
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
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
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
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

  return parens ? `(${sql})` : sql;
};

const processAnds = (
  and: WhereItem[],
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
  parens?: boolean,
): string => {
  const ands: string[] = [];
  for (const data of and) {
    processWhere(ands, ctx, table, query, data, quotedAs);
  }
  const sql = ands.join(' AND ');
  return parens && ands.length > 1 ? `(${sql})` : sql;
};

const processWhere = (
  ands: string[],
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes' | 'language'>,
  data: WhereItem,
  quotedAs?: string,
) => {
  if (typeof data === 'function') {
    const qb = Object.create(table);
    qb.q = getClonedQueryData(query as QueryData);
    qb.q.and = qb.q.or = undefined;
    qb.q.isSubQuery = true;

    const res = resolveSubQueryCallback(qb, data as never);
    const expr = res instanceof Expression ? res : res.q.expr;
    if (!(res instanceof Expression) && res.q.expr) {
      const q = joinSubQuery(table, res as Query);
      q.q.select = [expr as Expression];
      ands.push(`(${makeSQL(q as Query, ctx).text})`);
    } else {
      pushWhereToSql(ands, ctx, res as Query, (res as Query).q, quotedAs, true);
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
      ands.push(`(${sql})`);
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
      ands.push(processAnds(arr, ctx, table, query, quotedAs));
    } else if (key === 'OR') {
      const arr = (value as MaybeArray<WhereItem>[]).map(toArray);
      ands.push(
        arr
          .map((and) => processAnds(and, ctx, table, query, quotedAs))
          .join(' OR '),
      );
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

        ands.push(`${leftColumn} ${op} ${rightColumn}`);
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
    } else if (typeof value === 'object' && value && !(value instanceof Date)) {
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
        let column = query.shape[key];
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
            quotedColumn = undefined;
          }

          if (!column || !quotedColumn) {
            // TODO: custom error classes
            throw new Error(`Unknown column ${key} provided to condition`);
          }
        }

        if (value instanceof ctx.queryBuilder.constructor) {
          ands.push(`${quotedColumn} = (${(value as Query).toSQL(ctx).text})`);
        } else {
          for (const op in value) {
            const operator = (column.operators as BaseOperators)[op];
            if (!operator) {
              // TODO: custom error classes
              throw new Error(`Unknown operator ${op} provided to condition`);
            }

            if (value[op as keyof typeof value] === undefined) continue;

            ands.push(
              `${(operator as unknown as Operator<unknown>)._op(
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
        `${columnToSql(ctx, query, query.shape, key, quotedAs)} ${
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
  query: PickQueryDataShapeAndJoinedShapes,
  ands: string[],
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

  ands.push(`${multiple ? `(${columnsSql})` : columnsSql} IN ${value}`);
};
