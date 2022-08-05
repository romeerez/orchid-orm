import { Query } from '../query';
import { UpdateQueryData } from './types';
import { q } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
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

  data.forEach((item) => {
    if (isRaw(item)) {
      sql.push(getRaw(item));
    } else {
      const set: string[] = [];

      for (const key in item) {
        const value = item[key];
        if (value !== undefined) {
          set.push(`${q(key)} = ${processValue(key, value)}`);
        }
      }

      sql.push(set.join(', '));
    }
  });

  pushWhereSql(sql, model, query, quotedAs);
  pushReturningSql(sql, quotedAs, returning);
};

const processValue = (
  key: string,
  value: Exclude<UpdateQueryData['data'][number], RawExpression>[string],
) => {
  if (value && typeof value === 'object') {
    if (isRaw(value)) {
      return getRaw(value);
    } else if ('op' in value && 'arg' in value) {
      return `${q(key)} ${(value as { op: string }).op} ${quote(
        (value as { arg: unknown }).arg,
      )}`;
    }
  }

  return quote(value);
};
