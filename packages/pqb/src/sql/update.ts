import { Query } from '../query';
import { UpdateQueryData } from './types';
import { addValue, q, quoteSchemaAndTable } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
import { pushReturningSql } from './insert';
import { pushWhereSql } from './where';

export const pushUpdateSql = (
  sql: string[],
  values: unknown[],
  model: Query,
  query: UpdateQueryData,
  quotedAs: string,
) => {
  const quotedTable = quoteSchemaAndTable(query.schema, model.table as string);
  sql.push(`UPDATE ${quotedTable}`);

  if (query.as && quotedTable !== quotedAs) {
    sql.push(`AS ${quotedAs}`);
  }

  sql.push('SET');

  query.data.forEach((item) => {
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

  pushWhereSql(sql, model, query, model.shape, values, quotedAs);
  pushReturningSql(sql, model, query, values, quotedAs);
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
