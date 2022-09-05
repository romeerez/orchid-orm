import { q, quoteFullColumn, quoteSchemaAndTable } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
import {
  DeleteQueryData,
  InsertQueryData,
  JoinItem,
  QueryData,
  SelectQueryData,
  WhereItemContainer,
} from './types';
import { Query, Relation } from '../query';
import { whereToSql } from './where';

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
  model: Pick<Query, 'shape' | 'relations'>,
  values: unknown[],
  args: JoinItem['args'],
  quotedAs?: string,
): { target: string; conditions?: string } => {
  const [first] = args;
  if (typeof first === 'string') {
    if (first in model.relations) {
      const { key, joinQuery } = (model.relations as Record<string, Relation>)[
        first
      ];

      const table = (
        typeof joinQuery.query?.from === 'string'
          ? joinQuery.query.from
          : joinQuery.table
      ) as string;

      let target = quoteSchemaAndTable(joinQuery.query?.schema, table);

      const as = joinQuery.query?.as || key;
      if (as !== table) {
        target += ` AS ${q(as as string)}`;
      }

      const query = {
        and: [],
        or: [],
      } as {
        and: WhereItemContainer[];
        or: WhereItemContainer[][];
      };

      if (joinQuery.query) {
        if (joinQuery.query.and) query.and.push(...joinQuery.query.and);
        if (joinQuery.query.or) query.or.push(...joinQuery.query.or);
      }

      const arg = (
        args[1] as undefined | { type: 'query'; query: { query?: QueryData } }
      )?.query.query;

      if (arg) {
        if (arg.and) query.and.push(...arg.and);
        if (arg.or) query.or.push(...arg.or);
      }

      const joinAs = q(as as string);
      const onConditions = whereToSql(
        joinQuery,
        query,
        values,
        quotedAs,
        joinAs,
      );
      const conditions = onConditions ? onConditions : undefined;

      return { target, conditions };
    }

    const target = q(first);
    let conditions: string | undefined;

    if (args.length === 2) {
      const [, arg] = args;
      if (arg.type === 'objectOrRaw') {
        conditions = getObjectOrRawConditions(
          arg.data,
          values,
          quotedAs,
          target,
        );
      } else if (arg.query.query) {
        const onConditions = whereToSql(
          model,
          arg.query.query,
          values,
          quotedAs,
          target,
        );
        if (onConditions) conditions = onConditions;
      }
    } else if (args.length >= 3) {
      conditions = getConditionsFor3Or4LengthItem(
        target,
        values,
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
    const [, arg] = args;
    if (arg.type === 'objectOrRaw') {
      conditions = getObjectOrRawConditions(arg.data, values, quotedAs, joinAs);
    } else if (arg.query.query) {
      const onConditions = whereToSql(
        model,
        arg.query.query,
        values,
        quotedAs,
        joinAs,
      );
      if (onConditions) conditions = onConditions;
    }
  } else if (args.length >= 3) {
    conditions = getConditionsFor3Or4LengthItem(
      joinAs,
      values,
      quotedAs,
      args as ItemOf3Or4Length,
    );
  }

  if (joinQuery) {
    const whereSql = whereToSql(model, joinQuery, values, joinAs, quotedAs);
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
  sql: string[],
  model: Query,
  query: SelectQueryData | InsertQueryData | DeleteQueryData,
  values: unknown[],
  quotedAs?: string,
) => {
  query.join?.forEach((item) => {
    const { target, conditions } = processJoinItem(
      model,
      values,
      item.args,
      quotedAs,
    );

    sql.push(item.type, target);
    if (conditions) sql.push('ON', conditions);
  });
};
