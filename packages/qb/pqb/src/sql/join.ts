import {
  ColumnNamesShape,
  q,
  quoteSchemaAndTable,
  rawOrRevealColumnToSql,
  revealColumnToSql,
} from './common';
import { JoinItem } from './types';
import { QueryBase, QueryWithTable } from '../query';
import { whereToSql } from './where';
import { Relation } from '../relations';
import { ToSqlCtx } from './toSql';
import { getRaw } from '../raw';
import { QueryData } from './data';
import {
  ColumnsShapeBase,
  emptyObject,
  isRaw,
  RawExpression,
} from 'orchid-core';

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
  item: Pick<JoinItem, 'args' | 'isSubQuery'>,
  quotedAs: string | undefined,
): { target: string; conditions?: string } => {
  let target: string;
  let conditions: string | undefined;

  const { args } = item;
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

      query.joinedShapes = {
        ...table.query.joinedShapes,
        [(table.query.as || table.table) as string]: table.shape,
      };

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
      const joinShape = (
        table.query.joinedShapes as Record<string, ColumnsShapeBase>
      )[first];
      conditions = processArgs(
        args,
        ctx,
        table,
        first,
        target,
        joinShape,
        quotedAs,
      );
    }
  } else {
    const query = first.query;

    const quotedFrom =
      typeof query.from === 'string' ? q(query.from) : undefined;

    target = quotedFrom || quoteSchemaAndTable(query.schema, first.table);

    let joinAs = quotedFrom || q(first.table);

    const qAs = query.as ? q(query.as) : undefined;
    const addAs = qAs && qAs !== joinAs;

    let joinedShape: ColumnsShapeBase;
    if (item.isSubQuery) {
      const subQuery = first.toSql({
        values: ctx.values,
      });

      target = `(${subQuery.text}) ${qAs || joinAs}`;
      if (addAs) joinAs = qAs;

      // if it is a sub query, the columns name are revealed inside, and then addressed directly by the keys
      joinedShape = emptyObject;
    } else {
      joinedShape = first.shape;

      if (addAs) {
        joinAs = qAs;
        target += ` AS ${qAs}`;
      }
    }

    conditions = processArgs(
      args,
      ctx,
      table,
      first,
      joinAs,
      joinedShape,
      quotedAs,
    );

    // if it's a sub query, WHERE conditions are already in the sub query
    if (!item.isSubQuery) {
      const whereSql = whereToSql(ctx, table, query, joinAs);
      if (whereSql) {
        if (conditions) conditions += ` AND ${whereSql}`;
        else conditions = whereSql;
      }
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
  joinShape: ColumnNamesShape,
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
      return getObjectOrRawConditions(
        table.query,
        arg,
        ctx.values,
        quotedAs,
        joinAs,
        joinShape,
      );
    }
  } else if (args.length >= 3) {
    return getConditionsFor3Or4LengthItem(
      table.query,
      joinAs,
      ctx.values,
      quotedAs,
      args as ItemOf3Or4Length,
      joinShape,
    );
  }

  return undefined;
};

const getConditionsFor3Or4LengthItem = (
  query: QueryData,
  target: string,
  values: unknown[],
  quotedAs: string | undefined,
  args: ItemOf3Or4Length,
  joinShape: ColumnNamesShape,
): string => {
  const [, leftColumn, opOrRightColumn, maybeRightColumn] = args;

  const op = maybeRightColumn ? opOrRightColumn : '=';
  const rightColumn = maybeRightColumn ? maybeRightColumn : opOrRightColumn;

  return `${rawOrRevealColumnToSql(
    query,
    leftColumn,
    values,
    target,
    joinShape,
  )} ${op} ${rawOrRevealColumnToSql(
    query,
    rightColumn,
    values,
    quotedAs,
    query.shape,
  )}`;
};

const getObjectOrRawConditions = (
  query: QueryData,
  data: Record<string, string | RawExpression> | RawExpression | true,
  values: unknown[],
  quotedAs: string | undefined,
  joinAs: string,
  joinShape: ColumnNamesShape,
): string => {
  if (data === true) {
    return 'true';
  } else if (isRaw(data)) {
    return getRaw(data, values);
  } else {
    const pairs: string[] = [];
    const shape = query.shape;

    for (const key in data) {
      const value = data[key];

      pairs.push(
        `${revealColumnToSql(
          query,
          joinShape,
          key,
          joinAs,
        )} = ${rawOrRevealColumnToSql(query, value, values, quotedAs, shape)}`,
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
    const { target, conditions } = processJoinItem(ctx, table, item, quotedAs);

    ctx.sql.push(item.type, target);
    if (conditions) ctx.sql.push('ON', conditions);
  });
};

const skipQueryKeysForSubQuery: Record<string, boolean> = {
  adapter: true,
  updateData: true,
  parsers: true,
  as: true,
  and: true,
  or: true,
};

export const getIsJoinSubQuery = (query: QueryData, baseQuery: QueryData) => {
  for (const key in query) {
    if (
      !skipQueryKeysForSubQuery[key] &&
      (query as Record<string, unknown>)[key] !==
        (baseQuery as Record<string, unknown>)[key]
    ) {
      return true;
    }
  }
  return false;
};
