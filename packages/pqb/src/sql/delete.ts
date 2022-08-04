import { Query } from '../query';
import { QueryData } from './types';
import { pushWhereSql } from './where';
import { pushReturningSql } from './insert';
import { processJoinItem } from './join';

export const pushDeleteSql = (
  sql: string[],
  model: Query,
  query: QueryData,
  quotedAs: string,
  { returning }: Exclude<QueryData['delete'], undefined>,
) => {
  sql.push(`DELETE FROM ${quotedAs}`);

  let conditions: string | undefined;
  if (query.join?.length) {
    const items = query.join.map((item) =>
      processJoinItem(model, query, item, quotedAs),
    );

    sql.push(`USING ${items.map((item) => item.target).join(', ')}`);

    conditions = items
      .map((item) => item.conditions)
      .filter(Boolean)
      .join(' AND ');
  }

  pushWhereSql(sql, model, query, quotedAs);

  if (conditions) {
    if (query.and?.length || query.or?.length) {
      sql.push('AND', conditions);
    } else {
      sql.push('WHERE', conditions);
    }
  }

  pushReturningSql(sql, quotedAs, returning);
};
