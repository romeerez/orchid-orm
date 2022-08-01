import { q, quoteFullColumn, quoteSchemaAndTable } from './common';
import { getRaw, isRaw } from '../common';
import { QueryData } from './types';
import { Query, QueryWithData, QueryWithTable } from '../query';
import { whereToSql } from './where';
import { ColumnsShape } from '../columnSchema';

export const pushJoinSql = (
  sql: string[],
  model: Query,
  query: QueryData,
  quotedAs?: string,
) => {
  query.join?.forEach((item) => {
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

        sql.push(
          `JOIN ${quoteSchemaAndTable(query.query?.schema, query.table)}`,
        );

        const as = query.query?.as || key;
        if (as !== query.table) {
          sql.push(`AS ${q(as as string)}`);
        }

        const onConditions = whereToSql(
          query,
          joinQuery.query,
          quotedAs,
          q(as as string),
        );
        if (onConditions.length) sql.push('ON', onConditions);

        return;
      }

      const quoted = q(first);
      sql.push(`JOIN ${quoted}`);

      if (item.length === 2) {
        const arg = item[1];
        if (isRaw(arg)) {
          sql.push(`ON ${getRaw(arg)}`);
        } else if (arg.query) {
          const shape = query.withShapes?.[first] as ColumnsShape;
          const onConditions = whereToSql({ shape }, arg.query, quoted);
          if (onConditions.length) sql.push('ON', onConditions);
        }
      } else if (item.length === 4) {
        const [, leftColumn, op, rightColumn] = item as [
          unknown,
          string,
          string,
          string,
        ];

        sql.push(
          `ON ${quoteFullColumn(leftColumn, quoted)} ${op} ${quoteFullColumn(
            rightColumn as string,
            quotedAs,
          )}`,
        );
      }

      return;
    }

    const joinTarget = first;
    sql.push(
      `JOIN ${quoteSchemaAndTable(joinTarget.query?.schema, joinTarget.table)}`,
    );

    let joinAs: string;
    if (joinTarget.query?.as) {
      joinAs = q(joinTarget.query.as);
      sql.push(`AS ${joinAs}`);
    } else {
      joinAs = q(joinTarget.table);
    }

    if (item.length === 2) {
      const [, arg] = item;
      if (isRaw(arg)) {
        sql.push(`ON ${getRaw(arg)}`);
        return;
      }

      if (arg.query) {
        const onConditions = whereToSql(joinTarget, arg.query, joinAs);
        if (onConditions.length) sql.push('ON', onConditions);
      }
      return;
    } else if (item.length === 4) {
      const [, leftColumn, op, rightColumn] = item;
      sql.push(
        `ON ${quoteFullColumn(leftColumn, joinAs)} ${op} ${quoteFullColumn(
          rightColumn as string,
          quotedAs,
        )}`,
      );
    }
  });
};
