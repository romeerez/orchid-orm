import { q, quoteFullColumn, quoteSchemaAndTable } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
import {
  DeleteQueryData,
  InsertQueryData,
  JoinItem,
  SelectQueryData,
} from './types';
import { Query, QueryWithData, QueryWithTable } from '../query';
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
      const { key, query, joinQuery } = (
        model.relations as Record<
          string,
          {
            key: string;
            query: QueryWithTable;
            joinQuery: QueryWithData<Query>;
          }
        >
      )[first];

      let target = quoteSchemaAndTable(query.query?.schema, query.table);
      const as = query.query?.as || key;
      if (as !== query.table) {
        target += ` AS ${q(as as string)}`;
      }

      const onConditions = whereToSql(
        query,
        joinQuery.query,
        values,
        q(as as string),
        quotedAs,
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
  let target = quoteSchemaAndTable(joinTarget.query?.schema, joinTarget.table);

  let joinAs: string;
  if (joinTarget.query?.as) {
    joinAs = q(joinTarget.query.as);
    target += ` AS ${joinAs}`;
  } else {
    joinAs = q(joinTarget.table);
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
