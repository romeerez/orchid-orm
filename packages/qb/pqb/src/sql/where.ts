import { Query } from '../query';
import {
  SimpleJoinItem,
  WhereInItem,
  WhereItem,
  WhereJsonPathEqualsItem,
  WhereOnItem,
  WhereOnJoinItem,
} from './types';
import { addValue, q, qc, revealColumnToSql } from './common';
import { getQueryAs } from '../utils';
import { processJoinItem } from './join';
import { makeSql, ToSqlCtx } from './toSql';
import { getRaw } from './rawSql';
import { JoinedShapes, QueryData } from './data';
import { isRaw, RawExpression, MaybeArray, toArray } from 'orchid-core';
import { QueryBase } from '../queryBase';

export const pushWhereStatementSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
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
  ctx: ToSqlCtx,
  table: QueryBase,
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
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
  not?: boolean,
): string | undefined => {
  if (query.or) {
    const ors = query.and ? [query.and, ...query.or] : query.or;
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
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  quotedAs?: string,
  not?: boolean,
): string => {
  const ands: string[] = [];
  and.forEach((data) =>
    processWhere(ands, ctx, table, query, data, quotedAs, not),
  );
  return ands.join(' AND ');
};

const processWhere = (
  ands: string[],
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<QueryData, 'and' | 'or' | 'shape' | 'joinedShapes'>,
  data: WhereItem,
  quotedAs?: string,
  not?: boolean,
) => {
  const prefix = not ? 'NOT ' : '';

  if (typeof data === 'function') {
    const qb = data(new ctx.whereQueryBuilder(table, query));
    pushWhereToSql(ands, ctx, qb, qb.query, quotedAs, not);
    return;
  }

  if ('prototype' in data || 'baseQuery' in data) {
    const query = data as Query;
    const sql = whereToSql(
      ctx,
      query,
      query.query,
      query.table && q(query.table),
    );
    if (sql) {
      ands.push(`${prefix}(${sql})`);
    }
    return;
  }

  if (isRaw(data)) {
    ands.push(`${prefix}(${getRaw(data, ctx.values)})`);
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
        const leftColumn = revealColumnToSql(
          query,
          query.shape,
          item[0],
          quotedAs,
        );

        const leftPath = item[1];
        const rightColumn = revealColumnToSql(
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
        const leftColumn = revealColumnToSql(
          query,
          query.shape,
          item.on[0],
          q(getJoinItemSource(item.joinFrom)),
        );

        const joinTo = getJoinItemSource(item.joinTo);
        const joinedShape = (query.joinedShapes as JoinedShapes)[joinTo];

        const [op, rightColumn] =
          item.on.length === 2
            ? [
                '=',
                revealColumnToSql(query, joinedShape, item.on[1], q(joinTo)),
              ]
            : [
                item.on[1],
                revealColumnToSql(query, joinedShape, item.on[2], q(joinTo)),
              ];

        ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
      }
    } else if (key === 'IN') {
      toArray(value as MaybeArray<WhereInItem>).forEach((item) => {
        pushIn(query, ands, prefix, quotedAs, ctx.values, item);
      });
    } else if (key === 'EXISTS') {
      const joinItems = Array.isArray((value as unknown[])[0])
        ? value
        : [value];

      (
        joinItems as { args: SimpleJoinItem['args']; isSubQuery: boolean }[]
      ).forEach((args) => {
        const { target, conditions } = processJoinItem(
          ctx,
          table,
          query,
          args,
          quotedAs,
        );

        ands.push(
          `${prefix}EXISTS (SELECT 1 FROM ${target} WHERE ${conditions} LIMIT 1)`,
        );
      });
    } else if (
      typeof value === 'object' &&
      value &&
      value.constructor === Object
    ) {
      if (isRaw(value)) {
        ands.push(
          `${prefix}${revealColumnToSql(
            query,
            query.shape,
            key,
            quotedAs,
          )} = ${getRaw(value, ctx.values)}`,
        );
      } else {
        let column = query.shape[key];
        let quotedColumn: string | undefined;
        if (column) {
          quotedColumn = qc(column.data.name || key, quotedAs);
        } else if (!column) {
          const index = key.indexOf('.');
          if (index !== -1) {
            const joinedTable = key.slice(0, index);
            const joinedColumn = key.slice(index + 1);
            column = query.joinedShapes?.[joinedTable]?.[
              joinedColumn
            ] as typeof column;
            quotedColumn = qc(
              column?.data.name || joinedColumn,
              q(joinedTable),
            );
          } else {
            quotedColumn = undefined;
          }

          if (!column || !quotedColumn) {
            // TODO: custom error classes
            throw new Error(`Unknown column ${key} provided to condition`);
          }
        }

        for (const op in value) {
          const operator = column.operators[op];
          if (!operator) {
            // TODO: custom error classes
            throw new Error(`Unknown operator ${op} provided to condition`);
          }

          if (value[op as keyof typeof value] === undefined) continue;

          ands.push(
            `${prefix}${operator(
              quotedColumn as string,
              value[op as keyof typeof value],
              ctx.values,
            )}`,
          );
        }
      }
    } else {
      ands.push(
        `${prefix}${revealColumnToSql(query, query.shape, key, quotedAs)} ${
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
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  ands: string[],
  prefix: string,
  quotedAs: string | undefined,
  values: unknown[],
  arg: {
    columns: string[];
    values: unknown[][] | Query | RawExpression;
  },
) => {
  let value: string;

  if (Array.isArray(arg.values)) {
    value = `${arg.values
      .map(
        (arr) => `(${arr.map((value) => addValue(values, value)).join(', ')})`,
      )
      .join(', ')}`;

    if (arg.columns.length > 1) value = `(${value})`;
  } else if (isRaw(arg.values)) {
    value = getRaw(arg.values, values);
  } else {
    const sql = makeSql(arg.values, { values });
    value = `(${sql.text})`;
  }

  const columnsSql = arg.columns
    .map((column) => revealColumnToSql(query, query.shape, column, quotedAs))
    .join(', ');

  ands.push(
    `${prefix}${
      arg.columns.length > 1 ? `(${columnsSql})` : columnsSql
    } IN ${value}`,
  );
};
