import { q, quoteFullColumn, quoteSchemaAndTable } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
import { JoinItem, QueryData } from './types';
import { QueryBase } from '../query';
import { whereToSql } from './where';
import { Relation } from '../relations';
import { ToSqlCtx } from './toSql';

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
  model: QueryBase,
  args: JoinItem['args'],
  quotedAs?: string,
): { target: string; conditions?: string } => {
  const [first] = args;
  if (typeof first === 'string') {
    if (first in model.relations) {
      const {
        key,
        query: toQuery,
        joinQuery,
      } = (model.relations as Record<string, Relation>)[first];

      const joinedQuery = joinQuery(model, toQuery);
      const joinedQueryData = joinedQuery.query;

      const table = (
        typeof joinedQueryData.from === 'string'
          ? joinedQueryData.from
          : joinedQuery.table
      ) as string;

      let target = quoteSchemaAndTable(joinedQueryData.schema, table);

      const as = joinedQueryData.as || key;
      if (as !== table) {
        target += ` AS ${q(as as string)}`;
      }

      const queryData = {
        as: joinedQuery.query.as,
        and: [],
        or: [],
      } as {
        as?: string;
        and: Exclude<QueryData['and'], undefined>;
        or: Exclude<QueryData['or'], undefined>;
      };

      if (joinedQueryData.and) queryData.and.push(...joinedQueryData.and);
      if (joinedQueryData.or) queryData.or.push(...joinedQueryData.or);

      const arg = (args[1] as ((q: unknown) => QueryBase) | undefined)?.(
        new ctx.onQueryBuilder(joinedQuery, joinedQuery.shape, model),
      ).query;

      if (arg) {
        if (arg.and) queryData.and.push(...arg.and);
        if (arg.or) queryData.or.push(...arg.or);
      }

      const joinAs = q(as as string);
      const onConditions = whereToSql(ctx, joinedQuery, queryData, joinAs);
      const conditions = onConditions ? onConditions : undefined;

      return { target, conditions };
    }

    const target = q(first);
    let conditions: string | undefined;

    if (args.length === 2) {
      const arg = args[1];
      if (typeof arg === 'function') {
        const shape = model.query.withShapes?.[first];
        if (!shape) {
          throw new Error('Cannot get shape of `with` statement');
        }

        const joinQuery = arg(new ctx.onQueryBuilder(first, shape, model));
        const onConditions = whereToSql(
          ctx,
          joinQuery,
          joinQuery.query,
          quotedAs,
        );
        if (onConditions) conditions = onConditions;
      } else {
        conditions = getObjectOrRawConditions(
          arg,
          ctx.values,
          quotedAs,
          target,
        );
      }
    } else if (args.length >= 3) {
      conditions = getConditionsFor3Or4LengthItem(
        target,
        ctx.values,
        quotedAs,
        args as ItemOf3Or4Length,
      );
    }

    return { target, conditions };
  }

  const joinTarget = first;
  const joinQuery = joinTarget.query;

  const quotedFrom =
    typeof joinQuery?.from === 'string' ? q(joinQuery.from) : undefined;

  let target =
    quotedFrom || quoteSchemaAndTable(joinQuery?.schema, joinTarget.table);

  let joinAs = quotedFrom || q(joinTarget.table);
  if (joinQuery?.as) {
    const quoted = q(joinQuery.as);
    if (quoted !== joinAs) {
      joinAs = quoted;
      target += ` AS ${quoted}`;
    }
  }

  let conditions: string | undefined;

  if (args.length === 2) {
    const arg = args[1];
    if (typeof arg === 'function') {
      const qb = new ctx.onQueryBuilder(first, first.shape, model);
      const joinQuery = arg(qb);
      const onConditions = whereToSql(ctx, joinQuery, joinQuery.query, joinAs);
      if (onConditions) conditions = onConditions;
    } else {
      conditions = getObjectOrRawConditions(arg, ctx.values, quotedAs, joinAs);
    }
  } else if (args.length >= 3) {
    conditions = getConditionsFor3Or4LengthItem(
      joinAs,
      ctx.values,
      quotedAs,
      args as ItemOf3Or4Length,
    );
  }

  if (joinQuery) {
    const whereSql = whereToSql(ctx, model, joinQuery, joinAs);
    if (whereSql) {
      if (conditions) conditions += ` AND ${whereSql}`;
      else conditions = whereSql;
    }
  }

  return { target, conditions };
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
  model: QueryBase,
  query: QueryData & {
    join: JoinItem[];
  },
  quotedAs?: string,
) => {
  query.join.forEach((item) => {
    const { target, conditions } = processJoinItem(
      ctx,
      model,
      item.args,
      quotedAs,
    );

    ctx.sql.push(item.type, target);
    if (conditions) ctx.sql.push('ON', conditions);
  });
};
