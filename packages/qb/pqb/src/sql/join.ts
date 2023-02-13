import { q, quoteFullColumn, quoteSchemaAndTable } from './common';
import { JoinItem } from './types';
import { QueryBase, QueryWithTable } from '../query';
import { whereToSql } from './where';
import { Relation } from '../relations';
import { ToSqlCtx } from './toSql';
import { getRaw, isRaw, RawExpression } from '../raw';
import { QueryData } from './data';

type ItemOf3Or4Length =
  | [
      _: unknown,
      leftColumn: string | RawExpression,
      rightColumn: string | RawExpression,
    ]
  | [
      _: unknown,
      leftColumn: string | RawExpression,
      op: string,
      rightColumn?: string | RawExpression,
    ];

export const processJoinItem = (
  ctx: ToSqlCtx,
  table: QueryBase,
  args: JoinItem['args'],
  quotedAs?: string,
): { target: string; conditions?: string } => {
  let target: string;
  let conditions: string | undefined;

  const [first] = args;
  if (typeof first === 'string') {
    if (first in table.relations) {
      const {
        key,
        query: toQuery,
        joinQuery,
      } = (table.relations as Record<string, Relation>)[first];

      const jq = joinQuery(table, toQuery);
      const { query } = jq;

      const tableName = (
        typeof query.from === 'string' ? query.from : jq.table
      ) as string;

      target = quoteSchemaAndTable(query.schema, tableName);

      const as = query.as || key;
      const joinAs = q(as as string);
      if (as !== tableName) {
        target += ` AS ${joinAs}`;
      }

      const queryData = {
        and: query.and ? [...query.and] : [],
        or: query.or ? [...query.or] : [],
      };

      if (args[1]) {
        const arg = (args[1] as (q: unknown) => QueryBase)(
          new ctx.onQueryBuilder(jq, jq.query.shape, table),
        ).query;

        if (arg.and) queryData.and.push(...arg.and);
        if (arg.or) queryData.or.push(...arg.or);
      }

      conditions = whereToSql(ctx, jq, queryData, joinAs);
    } else {
      target = q(first);
      conditions = processArgs(args, ctx, table, first, target, quotedAs);
    }
  } else {
    const query = first.query;

    const quotedFrom =
      typeof query.from === 'string' ? q(query.from) : undefined;

    target = quotedFrom || quoteSchemaAndTable(query.schema, first.table);

    let joinAs = quotedFrom || q(first.table);
    if (query.as) {
      const quoted = q(query.as);
      if (quoted !== joinAs) {
        joinAs = quoted;
        target += ` AS ${quoted}`;
      }
    }

    conditions = processArgs(args, ctx, table, first, joinAs, quotedAs);

    const whereSql = whereToSql(ctx, table, query, joinAs);
    if (whereSql) {
      if (conditions) conditions += ` AND ${whereSql}`;
      else conditions = whereSql;
    }
  }

  return { target, conditions };
};

const processArgs = (
  args: JoinItem['args'],
  ctx: ToSqlCtx,
  table: QueryBase,
  first: string | QueryWithTable,
  joinAs: string,
  quotedAs?: string,
) => {
  if (args.length === 2) {
    const arg = args[1];
    if (typeof arg === 'function') {
      let shape;
      if (typeof first === 'string') {
        shape = table.query.withShapes?.[first];
        if (!shape) {
          throw new Error('Cannot get shape of `with` statement');
        }
      } else {
        shape = first.query.shape;
      }

      const jq = arg(new ctx.onQueryBuilder(first, shape, table));
      return whereToSql(ctx, jq, jq.query, joinAs);
    } else {
      return getObjectOrRawConditions(arg, ctx.values, quotedAs, joinAs);
    }
  } else if (args.length >= 3) {
    return getConditionsFor3Or4LengthItem(
      joinAs,
      ctx.values,
      quotedAs,
      args as ItemOf3Or4Length,
    );
  }

  return undefined;
};

const getConditionsFor3Or4LengthItem = (
  target: string,
  values: unknown[],
  quotedAs: string | undefined,
  args: ItemOf3Or4Length,
): string => {
  const [, leftColumn, opOrRightColumn, maybeRightColumn] = args;

  const op = maybeRightColumn ? opOrRightColumn : '=';
  const rightColumn = maybeRightColumn ? maybeRightColumn : opOrRightColumn;

  return `${
    typeof leftColumn === 'string'
      ? quoteFullColumn(leftColumn, target)
      : getRaw(leftColumn, values)
  } ${op} ${
    typeof rightColumn === 'string'
      ? quoteFullColumn(rightColumn, quotedAs)
      : getRaw(rightColumn, values)
  }`;
};

const getObjectOrRawConditions = (
  data: Record<string, string | RawExpression> | RawExpression,
  values: unknown[],
  quotedAs: string | undefined,
  joinAs: string | undefined,
): string => {
  if (isRaw(data)) {
    return getRaw(data, values);
  } else {
    const pairs: string[] = [];
    for (const key in data) {
      const value = data[key];

      pairs.push(
        `${quoteFullColumn(key, joinAs)} = ${
          typeof value === 'string'
            ? quoteFullColumn(value, quotedAs)
            : getRaw(value, values)
        }`,
      );
    }

    return pairs.join(', ');
  }
};

export const pushJoinSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: QueryData & {
    join: JoinItem[];
  },
  quotedAs?: string,
) => {
  query.join.forEach((item) => {
    const { target, conditions } = processJoinItem(
      ctx,
      table,
      item.args,
      quotedAs,
    );

    ctx.sql.push(item.type, target);
    if (conditions) ctx.sql.push('ON', conditions);
  });
};
