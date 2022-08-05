import { Query } from '../query';
import { UpdateQueryData } from './types';
import { q } from './common';
import { getRaw, isRaw } from '../common';
import { quote } from '../quote';
import { pushReturningSql } from './insert';
import { pushWhereSql } from './where';

export const pushUpdateSql = (
  sql: string[],
  model: Pick<Query, 'shape'>,
  query: UpdateQueryData,
  quotedAs: string,
) => {
  const { data, returning } = query;

  sql.push(`UPDATE ${quotedAs} SET`);

  if (isRaw(data)) {
    sql.push(getRaw(data));
  } else {
    const set: string[] = [];

    for (const key in data) {
      const value = data[key];
      if (value !== undefined) {
        set.push(
          `${q(key)} = ${
            value && typeof value === 'object' && isRaw(value)
              ? getRaw(value)
              : quote(value)
          }`,
        );
      }
    }

    sql.push(set.join(', '));
  }

  pushWhereSql(sql, model, query, quotedAs);
  pushReturningSql(sql, quotedAs, returning);
};
