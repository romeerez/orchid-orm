import {
  ColumnNamesShape,
  q,
  quoteSchemaAndTable,
  rawOrRevealColumnToSql,
  revealColumnToSql,
} from './common';
import { JoinItem, SimpleJoinItem } from './types';
import { Query, QueryWithTable } from '../query';
import { whereToSql } from './where';
import { Relation } from '../relations';
import { ToSqlCtx } from './toSql';
import { getRaw } from './rawSql';
import { JoinedShapes, QueryData, SelectQueryData } from './data';
import { isRaw, RawExpression } from 'orchid-core';
import { pushQueryArray } from '../queryDataUtils';
import { QueryBase } from '../queryBase';

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
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  item: Pick<SimpleJoinItem, 'args' | 'isSubQuery'>,
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
      const { query: j } = jq;

      const tableName = (
        typeof j.from === 'string' ? j.from : jq.table
      ) as string;

      target = quoteSchemaAndTable(j.schema, tableName);

      const as = j.as || key;
      const joinAs = q(as as string);
      if (as !== tableName) {
        target += ` AS ${joinAs}`;
      }

      const queryData = {
        shape: j.shape,
        joinedShapes: {
          ...query.joinedShapes,
          ...j.joinedShapes,
          [(table.query.as || table.table) as string]: table.shape,
        },
        and: j.and ? [...j.and] : [],
        or: j.or ? [...j.or] : [],
      };

      if (args[1]) {
        const arg = (args[1] as (q: unknown) => QueryBase)(
          new ctx.queryBuilder.onQueryBuilder(jq, j, table),
        ).query;

        if (arg.and) queryData.and.push(...arg.and);
        if (arg.or) queryData.or.push(...arg.or);
      }

      conditions = whereToSql(ctx, jq, queryData, joinAs);
    } else {
      target = q(first);
      const joinShape = (query.joinedShapes as JoinedShapes)[first];
      conditions = processArgs(
        args,
        ctx,
        table,
        query,
        first,
        target,
        joinShape,
        quotedAs,
      );
    }
  } else {
    const joinQuery = first.query;

    const quotedFrom =
      typeof joinQuery.from === 'string' ? q(joinQuery.from) : undefined;

    target = quotedFrom || quoteSchemaAndTable(joinQuery.schema, first.table);

    let joinAs = quotedFrom || q(first.table);

    const qAs = joinQuery.as ? q(joinQuery.as) : undefined;
    const addAs = qAs && qAs !== joinAs;

    const joinedShape = first.shape;
    if (item.isSubQuery) {
      const subQuery = first.toSql({
        values: ctx.values,
      });

      target = `(${subQuery.text}) ${qAs || joinAs}`;
      if (addAs) joinAs = qAs;
    } else {
      if (addAs) {
        joinAs = qAs;
        target += ` AS ${qAs}`;
      }
    }

    conditions = processArgs(
      args,
      ctx,
      table,
      query,
      first,
      joinAs,
      joinedShape,
      quotedAs,
    );

    // if it's a sub query, WHERE conditions are already in the sub query
    if (!item.isSubQuery) {
      const whereSql = whereToSql(
        ctx,
        first,
        {
          ...joinQuery,
          joinedShapes: {
            ...query.joinedShapes,
            ...joinQuery.joinedShapes,
            [(table.query.as || table.table) as string]: table.query.shape,
          },
        },
        joinAs,
      );
      if (whereSql) {
        if (conditions) conditions += ` AND ${whereSql}`;
        else conditions = whereSql;
      }
    }
  }

  return { target, conditions };
};

const processArgs = (
  args: SimpleJoinItem['args'],
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  first:
    | string
    | (QueryWithTable & {
        joinQueryAfterCallback?(fromQuery: Query, toQuery: Query): Query;
      }),
  joinAs: string,
  joinShape: ColumnNamesShape,
  quotedAs?: string,
) => {
  if (args.length === 2) {
    const arg = args[1];
    if (typeof arg === 'function') {
      const joinedShapes = {
        ...query.joinedShapes,
        [(table.query.as || table.table) as string]: table.shape,
      };

      let q: QueryBase;
      let data;
      if (typeof first === 'string') {
        const name = first;
        const query = table.query;
        const shape = query.withShapes?.[name];
        if (!shape) {
          throw new Error('Cannot get shape of `with` statement');
        }
        q = Object.create(table);
        q.query = {
          type: undefined,
          shape,
          adapter: query.adapter,
          handleResult: query.handleResult,
          returnType: 'all',
          logger: query.logger,
        } as SelectQueryData;
        data = { shape, joinedShapes };
      } else {
        q = first;

        if (first.joinQueryAfterCallback) {
          let base = q.baseQuery;
          if (q.query.as) {
            base = base.as(q.query.as);
          }

          const { query } = first.joinQueryAfterCallback(table as Query, base);
          if (query.and) {
            pushQueryArray(q, 'and', query.and);
          }
          if (query.or) {
            pushQueryArray(q, 'or', query.or);
          }
        }

        data = {
          ...first.query,
          joinedShapes: { ...first.query.joinedShapes, ...joinedShapes },
        };
      }

      const jq = arg(new ctx.queryBuilder.onQueryBuilder(q, data, table));

      if (jq.query.joinedShapes !== joinedShapes) {
        jq.query.joinedShapes = {
          ...jq.query.joinedShapes,
          ...joinedShapes,
        };
      }

      return whereToSql(ctx, jq, jq.query, joinAs);
    } else {
      return getObjectOrRawConditions(
        query,
        arg,
        ctx.values,
        quotedAs,
        joinAs,
        joinShape,
      );
    }
  } else if (args.length >= 3) {
    return getConditionsFor3Or4LengthItem(
      query,
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
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
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
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
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
    if (Array.isArray(item)) {
      const q = item[1];
      const { aliasValue } = ctx;
      ctx.aliasValue = true;
      const as = item[2];
      ctx.sql.push(
        `${item[0]} LATERAL (${q.toSql(ctx).text}) "${
          query.joinOverrides?.[as] || as
        }" ON true`,
      );
      ctx.aliasValue = aliasValue;
    } else {
      const { target, conditions } = processJoinItem(
        ctx,
        table,
        query,
        item,
        quotedAs,
      );

      ctx.sql.push(item.type, target);
      if (conditions) ctx.sql.push('ON', conditions);
    }
  });
};

const skipQueryKeysForSubQuery: Record<string, boolean> = {
  adapter: true,
  updateData: true,
  parsers: true,
  as: true,
  and: true,
  or: true,
  returnType: true,
  joinedShapes: true,
  returnsOne: true,
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
