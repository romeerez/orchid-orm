import { JsonItem, SelectItem } from './types';
import { RawSQL } from './rawSql';
import { Query } from '../query/query';
import { addValue, q, columnToSql, columnToSqlWithAs } from './common';
import { OrchidOrmInternalError, UnhandledTypeError } from '../errors';
import { makeSQL, ToSQLCtx } from './toSQL';
import { SelectQueryData } from './data';
import { SelectableOrExpression } from '../common/utils';
import { isExpression } from 'orchid-core';
import { QueryBase } from '../query/queryBase';

const jsonColumnOrMethodToSql = (
  table: Query,
  column: string | JsonItem,
  values: unknown[],
  quotedAs?: string,
) => {
  return typeof column === 'string'
    ? columnToSql(table.q, table.q.shape, column, quotedAs)
    : jsonToSql(table, column, values, quotedAs);
};

export const jsonToSql = (
  table: Query,
  item: JsonItem,
  values: unknown[],
  quotedAs?: string,
): string => {
  const json = item.__json;
  if (json[0] === 'pathQuery') {
    const [, , , column, path, options] = json;
    return `jsonb_path_query(${jsonColumnOrMethodToSql(
      table,
      column,
      values,
      quotedAs,
    )}, ${addValue(values, path)}${
      options?.vars ? `, ${addValue(values, options.vars)}` : ''
    }${options?.silent ? ', true' : ''})`;
  } else if (json[0] === 'set') {
    const [, , , column, path, value, options] = json;
    return `jsonb_set(${jsonColumnOrMethodToSql(
      table,
      column,
      values,
      quotedAs,
    )}, '{${path.join(', ')}}', ${addValue(values, JSON.stringify(value))}${
      options?.createIfMissing ? ', true' : ''
    })`;
  } else if (json[0] === 'insert') {
    const [, , , column, path, value, options] = json;
    return `jsonb_insert(${jsonColumnOrMethodToSql(
      table,
      column,
      values,
      quotedAs,
    )}, '{${path.join(', ')}}', ${addValue(values, JSON.stringify(value))}${
      options?.insertAfter ? ', true' : ''
    })`;
  } else if (json[0] === 'remove') {
    const [, , , column, path] = json;
    return `${jsonColumnOrMethodToSql(
      table,
      column,
      values,
      quotedAs,
    )} #- '{${path.join(', ')}}'`;
  }
  return '';
};

export const pushSelectSql = (
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<SelectQueryData, 'select' | 'join'>,
  quotedAs?: string,
) => {
  ctx.sql.push(selectToSql(ctx, table, query, quotedAs));
};

export const selectToSql = (
  ctx: ToSQLCtx,
  table: Query,
  query: Pick<SelectQueryData, 'select' | 'join'>,
  quotedAs?: string,
): string => {
  if (query.select) {
    const list: string[] = [];
    for (const item of query.select) {
      if (typeof item === 'string') {
        list.push(
          item === '*'
            ? selectAllSql(table, query, quotedAs)
            : columnToSqlWithAs(table.q, item, quotedAs, true),
        );
      } else {
        if ('selectAs' in item) {
          const obj = item.selectAs as Record<
            string,
            SelectableOrExpression | Query
          >;
          for (const as in obj) {
            const value = obj[as];
            if (typeof value === 'object' || typeof value === 'function') {
              if (isExpression(value)) {
                list.push(`${value.toSQL(ctx, quotedAs)} AS ${q(as)}`);
              } else {
                pushSubQuerySql(ctx, value as Query, as, list, quotedAs);
              }
            } else {
              list.push(
                `${columnToSql(
                  table.q,
                  table.q.shape,
                  value as string,
                  quotedAs,
                  true,
                )} AS ${q(as)}`,
              );
            }
          }
        } else if ('__json' in item) {
          list.push(
            `${jsonToSql(table, item, ctx.values, quotedAs)} AS ${q(
              item.__json[1],
            )}`,
          );
        } else if (isExpression(item)) {
          // TODO: check if this branch evaluating
          const sql = item.toSQL(ctx, quotedAs);
          list.push(ctx.aliasValue ? `${sql} r` : sql);
        }
      }
    }
    return list.join(', ');
  }

  return selectAllSql(table, query, quotedAs);
};

export const selectAllSql = (
  table: QueryBase,
  query: Pick<SelectQueryData, 'join'>,
  quotedAs?: string,
) => {
  return query.join?.length
    ? table.internal.columnsForSelectAll
        ?.map((item) => `${quotedAs}.${item}`)
        .join(', ') || `${quotedAs}.*`
    : table.internal.columnsForSelectAll?.join(', ') || '*';
};

const pushSubQuerySql = (
  ctx: ToSQLCtx,
  query: Query,
  as: string,
  list: string[],
  quotedAs?: string,
) => {
  const { returnType = 'all' } = query.q;

  if (query.q.joinedForSelect) {
    let sql;
    switch (returnType) {
      case 'one':
      case 'oneOrThrow':
        sql = `row_to_json("${query.q.joinedForSelect}".*)`;
        break;
      case 'all':
      case 'pluck':
      case 'value':
      case 'valueOrThrow':
      case 'rows':
        sql = `"${query.q.joinedForSelect}".r`;
        break;
      case 'rowCount':
      case 'void':
        return;
      default:
        throw new UnhandledTypeError(query, returnType);
    }
    if (sql) list.push(`${coalesce(ctx, query, sql, quotedAs)} ${q(as)}`);
    return;
  }

  switch (returnType) {
    case 'all':
    case 'one':
    case 'oneOrThrow':
      query = query._json() as unknown as typeof query;
      break;
    case 'pluck': {
      const { select } = query.q;
      const first = select?.[0];
      if (!select || !first) {
        throw new OrchidOrmInternalError(
          query,
          `Nothing was selected for pluck`,
        );
      }

      const cloned = query.clone();
      cloned.q.select = [{ selectAs: { c: first } }] as SelectItem[];
      query = cloned._wrap(cloned.baseQuery.clone()) as unknown as typeof query;
      query._getOptional(new RawSQL(`COALESCE(json_agg("c"), '[]')`));
      break;
    }
    case 'value':
    case 'valueOrThrow':
    case 'rows':
    case 'rowCount':
    case 'void':
      break;
    default:
      throw new UnhandledTypeError(query, returnType);
  }

  list.push(
    `${coalesce(ctx, query, `(${makeSQL(query, ctx).text})`, quotedAs)} AS ${q(
      as,
    )}`,
  );
};

const coalesce = (
  ctx: ToSQLCtx,
  query: Query,
  sql: string,
  quotedAs?: string,
) => {
  const { coalesceValue } = query.q;
  if (coalesceValue !== undefined) {
    const value = isExpression(coalesceValue)
      ? coalesceValue.toSQL(ctx, quotedAs)
      : addValue(ctx.values, coalesceValue);
    return `COALESCE(${sql}, ${value})`;
  }

  return sql;
};
