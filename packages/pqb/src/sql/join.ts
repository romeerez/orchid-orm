import { q, quoteFullColumn, quoteSchemaAndTable } from './common';
import { getRaw, isRaw } from '../common';
import {
  DeleteQueryData,
  InsertQueryData,
  JoinItem,
  QueryData,
  SelectQueryData,
} from './types';
import { Query, QueryWithData, QueryWithTable } from '../query';
import { whereToSql } from './where';
import { ColumnsShape } from '../columnSchema';

export const processJoinItem = (
  model: Query,
  query: QueryData,
  item: JoinItem,
  quotedAs?: string,
): { target: string; conditions?: string } => {
  const [first] = item;
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
        quotedAs,
        q(as as string),
      );
      const conditions = onConditions ? onConditions : undefined;

      return { target, conditions };
    }

    const target = q(first);
    let conditions: string | undefined;

    if (item.length === 2) {
      const arg = item[1];
      if (isRaw(arg)) {
        conditions = getRaw(arg);
      } else if (arg.query) {
        const shape = query.withShapes?.[first] as ColumnsShape;
        const onConditions = whereToSql({ shape }, arg.query, target);
        if (onConditions) conditions = onConditions;
      }
    } else if (item.length === 4) {
      const [, leftColumn, op, rightColumn] = item as [
        unknown,
        string,
        string,
        string,
      ];

      conditions = `${quoteFullColumn(
        leftColumn,
        target,
      )} ${op} ${quoteFullColumn(rightColumn as string, quotedAs)}`;
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

  if (item.length === 2) {
    const [, arg] = item;
    if (isRaw(arg)) {
      conditions = getRaw(arg);
    } else if (arg.query) {
      const onConditions = whereToSql(joinTarget, arg.query, joinAs);
      if (onConditions) conditions = onConditions;
    }
  } else if (item.length === 4) {
    const [, leftColumn, op, rightColumn] = item;
    conditions = `${quoteFullColumn(
      leftColumn,
      joinAs,
    )} ${op} ${quoteFullColumn(rightColumn as string, quotedAs)}`;
  }

  return { target, conditions };
};

export const pushJoinSql = (
  sql: string[],
  model: Query,
  query: SelectQueryData | InsertQueryData | DeleteQueryData,
  quotedAs?: string,
) => {
  query.join?.forEach((item) => {
    const { target, conditions } = processJoinItem(
      model,
      query,
      item,
      quotedAs,
    );

    sql.push('JOIN', target);
    if (conditions) sql.push('ON', conditions);
  });
};
