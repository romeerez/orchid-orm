import { q, quoteFullColumn } from './common';
import { getRaw, isRaw } from '../common';
import { QueryData } from './types';
import { Query } from '../query';
import { whereToSql } from './where';

export const pushJoinSql = (
  sql: string[],
  model: Query,
  quotedAs: string,
  join: Exclude<QueryData['join'], undefined>,
) => {
  join.forEach((item) => {
    const [first] = item;
    if (typeof first !== 'object') {
      const { key, query, joinQuery } = model.relations[first];

      sql.push(`JOIN ${q(query.table)}`);

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

    const joinTarget = first;
    sql.push(`JOIN ${q(joinTarget.table)}`);

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
        `ON ${quoteFullColumn(joinAs, leftColumn)} ${op} ${quoteFullColumn(
          quotedAs,
          rightColumn as string,
        )}`,
      );
    }
  });
};
