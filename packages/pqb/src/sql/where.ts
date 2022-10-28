import { Query, QueryBase } from '../query';
import {
  JoinItem,
  QueryData,
  WhereInItem,
  WhereItem,
  WhereJsonPathEqualsItem,
  WhereOnItem,
  WhereOnJoinItem,
} from './types';
import { addValue, q, qc, quoteFullColumn } from './common';
import { EMPTY_OBJECT, getRaw, isRaw, RawExpression } from '../common';
import { getQueryAs, MaybeArray, toArray } from '../utils';
import { processJoinItem } from './join';
import { ToSqlCtx } from './toSql';

export const pushWhereSql = (
  ctx: ToSqlCtx,
  model: QueryBase,
  query: Pick<QueryData, 'as' | 'and' | 'or'>,
  quotedAs?: string,
) => {
  const whereConditions = whereToSql(ctx, model, query, quotedAs);
  if (whereConditions) {
    ctx.sql.push('WHERE', whereConditions);
  }
};

export const whereToSql = (
  ctx: ToSqlCtx,
  model: QueryBase,
  query: Pick<QueryData, 'as' | 'and' | 'or'>,
  quotedAs?: string,
  not?: boolean,
): string => {
  const or =
    query.and && query.or
      ? [query.and, ...query.or]
      : query.and
      ? [query.and]
      : query.or;
  if (!or?.length) return '';

  const ors: string[] = [];
  or.forEach((and) => {
    const ands: string[] = [];
    and.forEach((data) => {
      const prefix = not ? 'NOT ' : '';

      if (typeof data === 'function') {
        const qb = data(new ctx.whereQueryBuilder(model, model.shape));

        const sql = whereToSql(
          ctx,
          model,
          {
            as: query.as,
            and: qb.query.and,
            or: qb.query.or,
          },
          quotedAs,
          not,
        );
        if (sql) ands.push(sql);
        return;
      }

      if ('prototype' in data || '__model' in data) {
        const query = data as Query;
        const sql = whereToSql(
          ctx,
          query,
          query.query || EMPTY_OBJECT,
          query.table && q(query.table),
        );
        if (sql) {
          ands.push(`${prefix}(${sql})`);
        }
        return;
      }

      if (isRaw(data)) {
        ands.push(`${prefix}(${getRaw(data, ctx.values)})`);
        return;
      }

      for (const key in data) {
        const value = (data as Record<string, unknown>)[key];
        if (key === 'AND') {
          const sql = whereToSql(
            ctx,
            model,
            {
              and: toArray(value as MaybeArray<WhereItem>),
            },
            quotedAs,
            not,
          );
          if (sql) ands.push(sql);
        } else if (key === 'OR') {
          const sql = whereToSql(
            ctx,
            model,
            {
              or: (value as MaybeArray<WhereItem>[]).map(toArray),
            },
            quotedAs,
            not,
          );
          if (sql) ands.push(sql);
        } else if (key === 'NOT') {
          const sql = whereToSql(
            ctx,
            model,
            {
              and: toArray(value as MaybeArray<WhereItem>),
            },
            quotedAs,
            !not,
          );
          if (sql) ands.push(sql);
        } else if (key === 'ON') {
          if (Array.isArray(value)) {
            const item = value as WhereJsonPathEqualsItem;
            const leftColumn = quoteFullColumn(item[0], quotedAs);
            const leftPath = item[1];
            const rightColumn = quoteFullColumn(
              item[2],
              getQueryAs({
                table: model.table,
                query,
              }),
            );
            const rightPath = item[3];

            ands.push(
              `${prefix}jsonb_path_query_first(${leftColumn}, ${addValue(
                ctx.values,
                leftPath,
              )}) = jsonb_path_query_first(${rightColumn}, ${addValue(
                ctx.values,
                rightPath,
              )})`,
            );
          } else {
            const item = value as WhereOnItem;
            const leftColumn = quoteFullColumn(
              item.on[0],
              getJoinItemSource(item.joinFrom),
            );

            const joinTo = getJoinItemSource(item.joinTo);

            const [op, rightColumn] =
              item.on.length === 2
                ? ['=', quoteFullColumn(item.on[1], joinTo)]
                : [item.on[1], quoteFullColumn(item.on[2], joinTo)];

            ands.push(`${prefix}${leftColumn} ${op} ${rightColumn}`);
          }
        } else if (key === 'IN') {
          toArray(value as MaybeArray<WhereInItem>).forEach((item) => {
            pushIn(ands, prefix, quotedAs, ctx.values, item);
          });
        } else if (key === 'EXISTS') {
          const joinItems = Array.isArray((value as unknown[])[0])
            ? value
            : [value];
          (joinItems as JoinItem['args'][]).forEach((item) => {
            const { target, conditions } = processJoinItem(
              ctx,
              model,
              item,
              quotedAs,
            );

            ands.push(
              `${prefix}EXISTS (SELECT 1 FROM ${target} WHERE ${conditions} LIMIT 1)`,
            );
          });
        } else if (
          typeof value === 'object' &&
          value !== null &&
          value !== undefined
        ) {
          if (isRaw(value)) {
            ands.push(
              `${prefix}${quoteFullColumn(key, quotedAs)} = ${getRaw(
                value,
                ctx.values,
              )}`,
            );
          } else {
            const column = model.shape[key];
            if (!column) {
              // TODO: custom error classes
              throw new Error(`Unknown column ${key} provided to condition`);
            }

            for (const op in value) {
              const operator = column.operators[op];
              if (!operator) {
                // TODO: custom error classes
                throw new Error(`Unknown operator ${op} provided to condition`);
              }

              ands.push(
                `${prefix}${operator(
                  qc(key, quotedAs),
                  value[op as keyof typeof value],
                  ctx.values,
                )}`,
              );
            }
          }
        } else {
          ands.push(
            `${prefix}${quoteFullColumn(key, quotedAs)} ${
              value === null ? 'IS NULL' : `= ${addValue(ctx.values, value)}`
            }`,
          );
        }
      }
    });

    ors.push(ands.join(' AND '));
  });

  return ors.join(' OR ');
};

const getJoinItemSource = (joinItem: WhereOnJoinItem) => {
  return typeof joinItem === 'string' ? q(joinItem) : q(getQueryAs(joinItem));
};

const pushIn = (
  ands: string[],
  prefix: string,
  quotedAs: string | undefined,
  values: unknown[],
  arg: {
    columns: string[];
    values: unknown[][] | Query | RawExpression;
  },
) => {
  let value: string;

  if (Array.isArray(arg.values)) {
    value = `${arg.values
      .map(
        (arr) => `(${arr.map((value) => addValue(values, value)).join(', ')})`,
      )
      .join(', ')}`;

    if (arg.columns.length > 1) value = `(${value})`;
  } else if (isRaw(arg.values)) {
    value = getRaw(arg.values, values);
  } else {
    const sql = arg.values.toSql(values);
    value = `(${sql.text})`;
  }

  const columnsSql = arg.columns
    .map((column) => quoteFullColumn(column, quotedAs))
    .join(', ');

  ands.push(
    `${prefix}${
      arg.columns.length > 1 ? `(${columnsSql})` : columnsSql
    } IN ${value}`,
  );
};
