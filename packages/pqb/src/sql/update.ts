import { QueryBase } from '../query';
import { UpdateQueryData } from './types';
import { addValue, q, quoteSchemaAndTable } from './common';
import { getRaw, isRaw, RawExpression } from '../common';
import { pushReturningSql } from './insert';
import { pushWhereStatementSql } from './where';
import { ToSqlCtx } from './toSql';

export const pushUpdateSql = (
  ctx: ToSqlCtx,
  model: QueryBase,
  query: UpdateQueryData,
  quotedAs: string,
) => {
  const quotedTable = quoteSchemaAndTable(query.schema, model.table as string);
  ctx.sql.push(`UPDATE ${quotedTable}`);

  if (quotedTable !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  ctx.sql.push('SET');

  query.data.forEach((item) => {
    if (isRaw(item)) {
      ctx.sql.push(getRaw(item, ctx.values));
    } else {
      const set: string[] = [];

      for (const key in item) {
        const value = item[key];
        if (value !== undefined) {
          set.push(`${q(key)} = ${processValue(ctx.values, key, value)}`);
        }
      }

      ctx.sql.push(set.join(', '));
    }
  });

  pushWhereStatementSql(ctx, model, query, quotedAs);
  pushReturningSql(ctx, model, query, quotedAs);
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
