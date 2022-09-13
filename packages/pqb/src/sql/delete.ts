import { Query } from '../query';
import { DeleteQueryData } from './types';
import { pushWhereSql } from './where';
import { pushReturningSql } from './insert';
import { processJoinItem } from './join';

export const pushDeleteSql = (
  sql: string[],
  values: unknown[],
  model: Query,
  query: DeleteQueryData,
  quotedAs: string,
) => {
  sql.push(`DELETE FROM ${quotedAs}`);

  let conditions: string | undefined;
  if (query.join?.length) {
    const items = query.join.map((item) =>
      processJoinItem(model, query, values, item.args, quotedAs),
    );

    sql.push(`USING ${items.map((item) => item.target).join(', ')}`);

    conditions = items
      .map((item) => item.conditions)
      .filter(Boolean)
      .join(' AND ');
  }

  pushWhereSql(sql, model, query, values, quotedAs);

  if (conditions?.length) {
    if (query.and?.length || query.or?.length) {
      sql.push('AND', conditions);
    } else {
      sql.push('WHERE', conditions);
    }
  }

  pushReturningSql(sql, quotedAs, query.returning);
};
