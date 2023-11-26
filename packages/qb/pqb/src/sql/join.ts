import { quoteSchemaAndTable, rawOrColumnToSql, columnToSql } from './common';
import { JoinItem, SimpleJoinItem } from './types';
import { Query, QueryWithTable } from '../query/query';
import { whereToSql } from './where';
import { ToSQLCtx } from './toSQL';
import { JoinedShapes, QueryData, SelectQueryData } from './data';
import { pushQueryArray } from '../query/queryUtils';
import { QueryBase } from '../query/queryBase';
import { ColumnsShapeBase, Expression, isExpression } from 'orchid-core';
import { RelationJoinQuery } from '../relations';

type ItemOf3Or4Length =
  | [
      _: unknown,
      leftColumn: string | Expression,
      rightColumn: string | Expression,
    ]
  | [
      _: unknown,
      leftColumn: string | Expression,
      op: string,
      rightColumn?: string | Expression,
    ];

export const processJoinItem = (
  ctx: ToSQLCtx,
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
      const { query: toQuery, joinQuery } =
        table.relations[first].relationConfig;

      const jq = joinQuery(toQuery, table as Query);
      const { q: j } = jq;

      const tableName = (
        typeof j.from === 'string' ? j.from : jq.table
      ) as string;

      target = quoteSchemaAndTable(j.schema, tableName);

      const as = j.as || first;
      const joinAs = `"${as}"`;
      if (as !== tableName) {
        target += ` AS ${joinAs}`;
      }

      const queryData = {
        shape: j.shape,
        joinedShapes: {
          ...query.joinedShapes,
          ...j.joinedShapes,
          [(table.q.as || table.table) as string]: table.shape,
        },
        and: j.and ? [...j.and] : [],
        or: j.or ? [...j.or] : [],
      };

      if (args[1]) {
        const arg = (args[1] as (q: unknown) => QueryBase)(
          new ctx.queryBuilder.onQueryBuilder(jq, j, table),
        ).q;

        if (arg.and) queryData.and.push(...arg.and);
        if (arg.or) queryData.or.push(...arg.or);
      }

      conditions = whereToSql(ctx, jq, queryData, joinAs);
    } else {
      target = `"${first}"`;
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
    const joinQuery = first.q;

    const quotedFrom =
      typeof joinQuery.from === 'string' ? `"${joinQuery.from}"` : undefined;

    target = quotedFrom || quoteSchemaAndTable(joinQuery.schema, first.table);

    let joinAs = quotedFrom || `"${first.table}"`;

    const qAs = joinQuery.as ? `"${joinQuery.as}"` : undefined;
    const addAs = qAs && qAs !== joinAs;

    const joinedShape = first.shape;
    if (item.isSubQuery) {
      const subQuery = first.toSQL({
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
            [(table.q.as || table.table) as string]: table.q.shape,
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
  ctx: ToSQLCtx,
  table: QueryBase,
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  first:
    | string
    | (QueryWithTable & {
        joinQueryAfterCallback?: RelationJoinQuery;
      }),
  joinAs: string,
  joinShape: ColumnsShapeBase,
  quotedAs?: string,
) => {
  if (args.length === 2) {
    const arg = args[1];
    if (typeof arg === 'function') {
      const joinedShapes = {
        ...query.joinedShapes,
        [(table.q.as || table.table) as string]: table.shape,
      };

      let q: QueryBase;
      let data;
      if (typeof first === 'string') {
        const name = first;
        const query = table.q;
        const shape = query.withShapes?.[name];
        if (!shape) {
          throw new Error('Cannot get shape of `with` statement');
        }
        q = Object.create(table);
        q.q = {
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
          if (q.q.as) {
            base = base.as(q.q.as);
          }

          const { q: query } = first.joinQueryAfterCallback(
            base,
            table as Query,
          );
          if (query.and) {
            pushQueryArray(q, 'and', query.and);
          }
          if (query.or) {
            pushQueryArray(q, 'or', query.or);
          }
        }

        data = {
          ...first.q,
          joinedShapes: { ...first.q.joinedShapes, ...joinedShapes },
        };
      }

      const jq = arg(new ctx.queryBuilder.onQueryBuilder(q, data, table));

      if (jq.q.joinedShapes !== joinedShapes) {
        jq.q.joinedShapes = {
          ...jq.q.joinedShapes,
          ...joinedShapes,
        };
      }

      return whereToSql(ctx, jq as Query, jq.q, joinAs);
    } else {
      return getObjectOrRawConditions(
        ctx,
        query,
        arg,
        quotedAs,
        joinAs,
        joinShape,
      );
    }
  } else if (args.length >= 3) {
    return getConditionsFor3Or4LengthItem(
      ctx,
      query,
      joinAs,
      quotedAs,
      args as ItemOf3Or4Length,
      joinShape,
    );
  }

  return undefined;
};

const getConditionsFor3Or4LengthItem = (
  ctx: ToSQLCtx,
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  target: string,
  quotedAs: string | undefined,
  args: ItemOf3Or4Length,
  joinShape: ColumnsShapeBase,
): string => {
  const [, leftColumn, opOrRightColumn, maybeRightColumn] = args;

  const op = maybeRightColumn ? opOrRightColumn : '=';
  const rightColumn = maybeRightColumn ? maybeRightColumn : opOrRightColumn;

  return `${rawOrColumnToSql(
    ctx,
    query,
    leftColumn,
    target,
    joinShape,
  )} ${op} ${rawOrColumnToSql(ctx, query, rightColumn, quotedAs, query.shape)}`;
};

const getObjectOrRawConditions = (
  ctx: ToSQLCtx,
  query: Pick<QueryData, 'shape' | 'joinedShapes'>,
  data: Record<string, string | Expression> | Expression | true,
  quotedAs: string | undefined,
  joinAs: string,
  joinShape: ColumnsShapeBase,
): string => {
  if (data === true) {
    return 'true';
  } else if (isExpression(data)) {
    return data.toSQL(ctx, quotedAs);
  } else {
    const pairs: string[] = [];
    const shape = query.shape;

    for (const key in data) {
      const value = data[key];

      pairs.push(
        `${columnToSql(
          ctx,
          query,
          joinShape,
          key,
          joinAs,
        )} = ${rawOrColumnToSql(ctx, query, value, quotedAs, shape)}`,
      );
    }

    return pairs.join(', ');
  }
};

export const pushJoinSql = (
  ctx: ToSQLCtx,
  table: QueryBase,
  query: QueryData & {
    join: JoinItem[];
  },
  quotedAs?: string,
) => {
  for (const item of query.join) {
    if (Array.isArray(item)) {
      const q = item[1];
      const { aliasValue } = ctx;
      ctx.aliasValue = true;
      const as = item[2];
      ctx.sql.push(
        `${item[0]} LATERAL (${q.toSQL(ctx).text}) "${
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
  }
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
