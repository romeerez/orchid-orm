import { Query } from '../query';
import { UpdateQueryData } from './types';
import { addValue, q } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
import { pushReturningSql } from './insert';
import { pushWhereSql } from './where';

export const pushUpdateSql = (
  sql: string[],
  values: unknown[],
  model: Pick<Query, 'shape' | 'relations'>,
  query: UpdateQueryData,
  quotedAs: string,
) => {
  const { data, returning } = query;

  sql.push(`UPDATE ${quotedAs} SET`);

  data.forEach((item) => {
    if (isRaw(item)) {
      sql.push(getRaw(item, values));
    } else {
      const set: string[] = [];

      for (const key in item) {
        const value = item[key];
        if (value !== undefined) {
          set.push(`${q(key)} = ${processValue(values, key, value)}`);
        }
      }

      sql.push(set.join(', '));
    }
  });

  pushWhereSql(sql, model, query, values, quotedAs);
  pushReturningSql(sql, quotedAs, returning);
};

const processValue = (
  values: unknown[],
  key: string,
  value: Exclude<UpdateQueryData['data'][number], RawExpression>[string],
) => {
  if (value && typeof value === 'object') {
    if (isRaw(value)) {
      return getRaw(value, values);
    } else if ('op' in value && 'arg' in value) {
      return `${q(key)} ${(value as { op: string }).op} ${addValue(
        values,
        (value as { arg: unknown }).arg,
      )}`;
    }
  }

  return addValue(values, value);
};
