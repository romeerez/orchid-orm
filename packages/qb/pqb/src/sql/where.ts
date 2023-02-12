import { Query, QueryBase } from '../query';
import {
  JoinItem,
  WhereInItem,
  WhereItem,
  WhereJsonPathEqualsItem,
  WhereOnItem,
  WhereOnJoinItem,
} from './types';
import { addValue, q, qc, quoteFullColumn } from './common';
import { getQueryAs, MaybeArray, toArray } from '../utils';
import { processJoinItem } from './join';
import { makeSql, ToSqlCtx } from './toSql';
import { getRaw, isRaw, RawExpression } from '../raw';
import { QueryData } from './data';

export const pushWhereStatementSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<QueryData, 'and' | 'or'>,
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
  query: Pick<QueryData, 'and' | 'or'>,
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
  query: Pick<QueryData, 'and' | 'or'>,
  quotedAs?: string,
  not?: boolean,
): string | undefined => {
  if (query.or) {
    const ors = query.and ? [query.and, ...query.or] : query.or;
    return ors
      .map((and) => processAnds(and, ctx, table, quotedAs, not))
      .join(' OR ');
  } else if (query.and) {
    return processAnds(query.and, ctx, table, quotedAs, not);
  } else {
    return undefined;
  }
};

const processAnds = (
  and: WhereItem[],
  ctx: ToSqlCtx,
  table: QueryBase,
  quotedAs?: string,
  not?: boolean,
): string => {
  const ands: string[] = [];
  and.forEach((data) => processWhere(ands, ctx, table, data, quotedAs, not));
  return ands.join(' AND ');
};

const processWhere = (
  ands: string[],
  ctx: ToSqlCtx,
  table: QueryBase,
  data: WhereItem,
  quotedAs?: string,
  not?: boolean,
) => {
  const prefix = not ? 'NOT ' : '';

  if (typeof data === 'function') {
    const qb = data(new ctx.whereQueryBuilder(table, table.shape));
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
    if (key === 'AND') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      ands.push(processAnds(arr, ctx, table, quotedAs, not));
    } else if (key === 'OR') {
      const arr = (value as MaybeArray<WhereItem>[]).map(toArray);
      ands.push(
        arr
          .map((and) => processAnds(and, ctx, table, quotedAs, not))
          .join(' OR '),
      );
    } else if (key === 'NOT') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      ands.push(processAnds(arr, ctx, table, quotedAs, !not));
    } else if (key === 'ON') {
      if (Array.isArray(value)) {
        const item = value as WhereJsonPathEqualsItem;
        const leftColumn = quoteFullColumn(item[0], quotedAs);
        const leftPath = item[1];
        const rightColumn = quoteFullColumn(
          item[2],
          getQueryAs({
            table: table.table,
            query: { as: quotedAs },
          }),
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
        const leftColumn = quoteFullColumn(
          item.on[0],
          getJoinItemSource(item.joinFrom),
        );

        const joinTo = getJoinItemSource(item.joinTo);

        const [op, rightColumn] =
          item.on.length === 2
            ? ['=', quoteFullColumn(item.on[1], joinTo)]
            : [item.on[1], quoteFullColumn(item.on[2], joinTo)];

        ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
      }
    } else if (key === 'IN') {
      toArray(value as MaybeArray<WhereInItem>).forEach((item) => {
        pushIn(ands, prefix, quotedAs, ctx.values, item);
      });
    } else if (key === 'EXISTS') {
      const joinItems = Array.isArray((value as unknown[])[0])
        ? value
        : [value];
      (joinItems as JoinItem['args'][]).forEach((item) => {
        const { target, conditions } = processJoinItem(
          ctx,
          table,
          item,
          quotedAs,
        );

        ands.push(
          `${prefix}EXISTS (SELECT 1 FROM ${target} WHERE ${conditions} LIMIT 1)`,
        );
      });
    } else if (
      typeof value === 'object' &&
      value !== null &&
      value !== undefined
    ) {
      if (isRaw(value)) {
        ands.push(
          `${prefix}${quoteFullColumn(key, quotedAs)} = ${getRaw(
            value,
            ctx.values,
          )}`,
        );
      } else {
        const column = table.shape[key];
        if (!column) {
          // TODO: custom error classes
          throw new Error(`Unknown column ${key} provided to condition`);
        }

        for (const op in value) {
          const operator = column.operators[op];
          if (!operator) {
            // TODO: custom error classes
            throw new Error(`Unknown operator ${op} provided to condition`);
          }

          ands.push(
            `${prefix}${operator(
              qc(key, quotedAs),
              value[op as keyof typeof value],
              ctx.values,
            )}`,
          );
        }
      }
    } else {
      ands.push(
        `${prefix}${quoteFullColumn(key, quotedAs)} ${
          value === null ? 'IS NULL' : `= ${addValue(ctx.values, value)}`
        }`,
      );
    }
  }
};

const getJoinItemSource = (joinItem: WhereOnJoinItem) => {
  return typeof joinItem === 'string' ? q(joinItem) : q(getQueryAs(joinItem));
};

const pushIn = (
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
    .map((column) => quoteFullColumn(column, quotedAs))
    .join(', ');

  ands.push(
    `${prefix}${
      arg.columns.length > 1 ? `(${columnsSql})` : columnsSql
    } IN ${value}`,
  );
};
