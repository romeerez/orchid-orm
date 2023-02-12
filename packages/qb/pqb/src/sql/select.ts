import { JsonItem, SelectFunctionItem, SelectItem } from './types';
import { getRaw, isRaw, raw } from '../raw';
import { Query, QueryBase } from '../query';
import { addValue, q, quoteFullColumn } from './common';
import { aggregateToSql } from './aggregate';
import { PormInternalError, UnhandledTypeError } from '../errors';
import { makeSql, ToSqlCtx } from './toSql';
import { relationQueryKey } from '../relations';
import { SelectQueryData } from './data';
import { Expression } from '../utils';

const jsonColumnOrMethodToSql = (
  column: string | JsonItem,
  values: unknown[],
  quotedAs?: string,
) => {
  return typeof column === 'string'
    ? quoteFullColumn(column, quotedAs)
    : jsonToSql(column, values, quotedAs);
};

const jsonToSql = (
  item: JsonItem,
  values: unknown[],
  quotedAs?: string,
): string => {
  const json = item.__json;
  if (json[0] === 'pathQuery') {
    const [, , , column, path, options] = json;
    return `jsonb_path_query(${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )}, ${addValue(values, path)}${
      options?.vars ? `, ${addValue(values, options.vars)}` : ''
    }${options?.silent ? ', true' : ''})`;
  } else if (json[0] === 'set') {
    const [, , , column, path, value, options] = json;
    return `jsonb_set(${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )}, '{${path.join(', ')}}', ${addValue(values, JSON.stringify(value))}${
      options?.createIfMissing ? ', true' : ''
    })`;
  } else if (json[0] === 'insert') {
    const [, , , column, path, value, options] = json;
    return `jsonb_insert(${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )}, '{${path.join(', ')}}', ${addValue(values, JSON.stringify(value))}${
      options?.insertAfter ? ', true' : ''
    })`;
  } else if (json[0] === 'remove') {
    const [, , , column, path] = json;
    return `${jsonColumnOrMethodToSql(
      column,
      values,
      quotedAs,
    )} #- '{${path.join(', ')}}'`;
  }
  return '';
};

export const pushSelectSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<SelectQueryData, 'select' | 'join'>,
  quotedAs?: string,
) => {
  ctx.sql.push(selectToSql(ctx, table, query, quotedAs));
};

export const selectToSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: Pick<SelectQueryData, 'select' | 'join'>,
  quotedAs?: string,
): string => {
  if (query.select) {
    const list: string[] = [];
    query.select.forEach((item) => {
      if (typeof item === 'string') {
        list.push(
          item === '*'
            ? query.join?.length
              ? `${quotedAs}.*`
              : '*'
            : quoteFullColumn(item, quotedAs),
        );
      } else {
        if ('selectAs' in item) {
          const obj = item.selectAs as Record<string, Expression | Query>;
          for (const as in obj) {
            const value = obj[as];
            if (typeof value === 'object' || typeof value === 'function') {
              if (isRaw(value)) {
                list.push(`${getRaw(value, ctx.values)} AS ${q(as)}`);
              } else {
                pushSubQuerySql(value as Query, as, ctx.values, list);
              }
            } else {
              list.push(
                `${quoteFullColumn(value as string, quotedAs)} AS ${q(as)}`,
              );
            }
          }
        } else if ('__json' in item) {
          list.push(
            `${jsonToSql(item, ctx.values, quotedAs)} AS ${q(item.__json[1])}`,
          );
        } else if (isRaw(item)) {
          list.push(getRaw(item, ctx.values));
        } else if ('arguments' in item) {
          list.push(
            `${(item as SelectFunctionItem).function}(${selectToSql(
              ctx,
              table,
              { select: item.arguments },
              quotedAs,
            )})${item.as ? ` AS ${q((item as { as: string }).as)}` : ''}`,
          );
        } else {
          list.push(aggregateToSql(ctx, table, item, quotedAs));
        }
      }
    });
    return list.join(', ');
  } else {
    return query.join?.length ? `${quotedAs}.*` : '*';
  }
};

const pushSubQuerySql = (
  query: Query,
  as: string,
  values: unknown[],
  list: string[],
) => {
  const { returnType = 'all' } = query.query;

  const rel = query.query[relationQueryKey];
  if (rel) {
    query = rel.joinQuery(rel.sourceQuery, query);
  }

  switch (returnType) {
    case 'all':
    case 'one':
    case 'oneOrThrow':
      query = query._json() as unknown as typeof query;
      break;
    case 'pluck': {
      const { select } = query.query;
      const first = select?.[0];
      if (!select || !first) {
        throw new PormInternalError(`Nothing was selected for pluck`);
      }

      const cloned = query.clone();
      cloned.query.select = [{ selectAs: { c: first } }] as SelectItem[];
      query = cloned._wrap(cloned.__table.clone()) as unknown as typeof query;
      query._getOptional(raw(`COALESCE(json_agg("c"), '[]')`));
      break;
    }
    case 'rows':
    case 'value':
    case 'valueOrThrow':
    case 'rowCount':
    case 'void':
      break;
    default:
      throw new UnhandledTypeError(returnType);
  }

  let subQuerySql = `(${makeSql(query, { values }).text})`;
  const { coalesceValue } = query.query;
  if (coalesceValue !== undefined) {
    let value;
    if (
      typeof coalesceValue === 'object' &&
      coalesceValue &&
      isRaw(coalesceValue)
    ) {
      value = getRaw(coalesceValue, values);
    } else {
      values.push(coalesceValue);
      value = `$${values.length}`;
    }
    subQuerySql = `COALESCE(${subQuerySql}, ${value})`;
  }
  list.push(`${subQuerySql} AS ${q(as)}`);
};
