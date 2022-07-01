import { Query, Output } from '../model';
import { quote } from './quote';
import { Expression, getRaw, isRaw, RawExpression } from './common';
import { ColumnsShape } from '../schema';
import { Aggregate1ArgumentTypes } from './aggregateMethods';
import { Operator } from './operators';
import type { Relation } from '../relations/relations';

// quote table or column
const q = (sql: string) => `"${sql}"`;
// quote column with table or as
const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`;

const quoteFullColumn = (quotedAs: string, fullColumn: string) => {
  const index = fullColumn.indexOf('.');
  if (index === -1) {
    return `${quotedAs}.${q(fullColumn)}`;
  } else {
    return `${q(fullColumn.slice(0, index))}.${q(fullColumn.slice(index + 1))}`;
  }
};

export type QueryData<T extends Query = Query> = {
  take?: true;
  select?: SelectItem<T>[];
  distinct?: Expression<T>[];
  from?: string | RawExpression;
  join?: JoinItem<T, Query, keyof T['relations']>[];
  and?: WhereItem<T>[];
  or?: WhereItem<T>[][];
  as?: string;
  group?: (keyof T['type'] | RawExpression)[];
  having?: HavingArg<T>[];
  window?: WindowArg<T>[];
  union?: { arg: UnionArg<T>; kind: UnionKind }[];
  order?: OrderBy<T>[];
  limit?: number;
  offset?: number;
  for?: RawExpression[];
};

export type SelectItem<T extends Query> =
  | keyof T['type']
  | Aggregate<T>
  | { selectAs: Record<string, Expression<T> | Query> };

export type JoinItem<
  T extends Query,
  Q extends Query,
  Rel extends keyof T['relations'],
> =
  | [relation: Rel]
  | [
      query: Q,
      leftColumn: keyof Q['type'],
      op: string,
      rightColumn: keyof T['type'],
    ]
  | [query: Q, raw: RawExpression]
  | [query: Q, on: Query];

export type WhereItem<T extends Query> =
  | Partial<Output<T['shape']>>
  | { [K in keyof T['shape']]?: ColumnOperators<T['shape'], K> | RawExpression }
  | Query
  | RawExpression
  | [leftFullColumn: string, op: string, rightFullColumn: string];

export type AggregateOptions<
  T extends Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  As extends string | undefined = any,
> = {
  as?: As;
  distinct?: boolean;
  order?: string;
  filter?: string;
  withinGroup?: boolean;
  over?: T['windows'][number] | WindowDeclaration<T>;
};

export type SortDir = 'ASC' | 'DESC';

export type OrderBy<T extends Query> =
  | {
      [K in keyof T['type']]?:
        | SortDir
        | { dir: SortDir; nulls: 'FIRST' | 'LAST' };
    }
  | RawExpression;

const aggregateOptionNames: (keyof AggregateOptions<Query>)[] = [
  'distinct',
  'order',
  'filter',
  'withinGroup',
];

export type AggregateArg<T extends Query> =
  | Expression<T>
  | Record<string, Expression<T>>
  | [Expression<T>, string];

export type Aggregate<T extends Query> = {
  function: string;
  arg: AggregateArg<T>;
  options: AggregateOptions<T>;
};

export type ColumnOperators<S extends ColumnsShape, Column extends keyof S> = {
  [O in keyof S[Column]['operators']]?: S[Column]['operators'][O]['type'];
};

export type HavingArg<T extends Query> =
  | {
      [Agg in keyof Aggregate1ArgumentTypes<T>]?: {
        [Column in Exclude<Aggregate1ArgumentTypes<T>[Agg], RawExpression>]?:
          | T['type'][Column]
          | (ColumnOperators<T['shape'], Column> & AggregateOptions<T>);
      };
    }
  | RawExpression;

export type WindowArg<T extends Query> = Record<
  string,
  WindowDeclaration<T> | RawExpression
>;

export type WindowDeclaration<T extends Query> = {
  partitionBy?: Expression<T>;
  order?: OrderBy<T>;
};

export type UnionArg<T extends Query> =
  | (Omit<Query, 'result'> & { result: T['result'] })
  | RawExpression;

type UnionKind =
  | 'UNION'
  | 'UNION ALL'
  | 'INTERSECT'
  | 'INTERSECT ALL'
  | 'EXCEPT'
  | 'EXCEPT ALL';

const EMPTY_OBJECT = {};

export const toSql = <T extends Query>(model: T): string => {
  const sql: string[] = ['SELECT'];

  const query = (model.query || EMPTY_OBJECT) as QueryData<T>;
  const quotedAs = q(query.as || model.table);

  if (query.distinct) {
    sql.push('DISTINCT');

    if (query.distinct.length) {
      const columns: string[] = [];
      query.distinct?.forEach((item) => {
        columns.push(expressionToSql(quotedAs, item));
      });
      sql.push(`ON (${columns.join(', ')})`);
    }
  }

  if (query.select) {
    const select: string[] = [];
    if (query.select) {
      query.select.forEach((item) => {
        if (typeof item === 'object') {
          if ('selectAs' in item) {
            const obj = item.selectAs as Record<string, Expression<T> | Query>;
            for (const as in obj) {
              const value = obj[as];
              if (typeof value === 'object') {
                if (isRaw(value)) {
                  select.push(`${getRaw(value)} AS ${q(as)}`);
                } else {
                  select.push(
                    `(${(value as Query).json().toSql()}) AS ${q(as)}`,
                  );
                }
              } else {
                select.push(`${qc(quotedAs, value as string)} AS ${q(as)}`);
              }
            }
          } else {
            select.push(aggregateToSql(quotedAs, item));
          }
        } else {
          select.push(qc(quotedAs, item as string));
        }
      });
    }
    sql.push(select.join(', '));
  } else {
    sql.push(`${quotedAs}.*`);
  }

  sql.push(
    'FROM',
    query.from
      ? typeof query.from === 'object'
        ? getRaw(query.from)
        : q(query.from)
      : q(model.table),
  );
  if (query.as) sql.push('AS', quotedAs);

  if (query.join) {
    query.join.forEach((item) => {
      const [first] = item;
      if (typeof first !== 'object') {
        const { key, query, joinQuery } = model.relations[first] as Relation;

        sql.push(`JOIN ${q(query.table)}`);

        const as = query.query?.as || key;
        if (as !== query.table) {
          sql.push(`AS ${q(as as string)}`);
        }

        const onConditions = whereConditionsToSql(
          query,
          joinQuery.query,
          quotedAs,
          q(as as string),
        );
        if (onConditions.length) sql.push('ON', onConditions);

        return;
      }

      const join = first;
      sql.push(`JOIN ${q(join.table)}`);

      let joinAs: string;
      if (join.query?.as) {
        joinAs = q(join.query.as);
        sql.push(`AS ${joinAs}`);
      } else {
        joinAs = q(join.table);
      }

      if (item.length === 2) {
        const [, arg] = item;
        if (isRaw(arg)) {
          sql.push(`ON ${getRaw(arg)}`);
          return;
        }

        if (arg.query) {
          const onConditions = whereConditionsToSql(join, arg.query, joinAs);
          if (onConditions.length) sql.push('ON', onConditions);
        }
        return;
      } else if (item.length === 4) {
        const [, leftColumn, op, rightColumn] = item;
        sql.push(
          `ON ${qc(joinAs, leftColumn)} ${op} ${qc(
            quotedAs,
            rightColumn as string,
          )}`,
        );
      }
    });
  }

  const whereConditions = whereConditionsToSql(model, query, quotedAs);
  if (whereConditions.length) sql.push('WHERE', whereConditions);

  if (query.group) {
    const group = query.group.map((item) =>
      typeof item === 'object' && isRaw(item)
        ? getRaw(item)
        : qc(quotedAs, item as string),
    );
    sql.push(`GROUP BY ${group.join(', ')}`);
  }

  if (query.having) {
    const having: string[] = [];
    query.having.forEach((item) => {
      if (isRaw(item)) {
        having.push(getRaw(item));
        return;
      }
      for (const key in item) {
        const columns = item[key as keyof Exclude<HavingArg<T>, RawExpression>];
        for (const column in columns) {
          const valueOrOptions = columns[column as keyof typeof columns];
          if (
            typeof valueOrOptions === 'object' &&
            valueOrOptions !== null &&
            valueOrOptions !== undefined
          ) {
            for (const op in valueOrOptions) {
              if (
                !aggregateOptionNames.includes(op as keyof AggregateOptions<T>)
              ) {
                const operator = model.schema.shape[column].operators[
                  op
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ] as Operator<any>;
                if (!operator) {
                  // TODO: custom error classes
                  throw new Error(
                    `Unknown operator ${op} provided to condition`,
                  );
                }
                having.push(
                  operator(
                    aggregateToSql(quotedAs, {
                      function: key,
                      arg: column,
                      options: valueOrOptions as AggregateOptions<T>,
                    }),
                    valueOrOptions[op],
                  ),
                );
              }
            }
          } else {
            having.push(
              `${aggregateToSql(quotedAs, {
                function: key,
                arg: column,
                options: EMPTY_OBJECT,
              })} = ${quote(valueOrOptions)}`,
            );
          }
        }
      }
    });
    sql.push(`HAVING ${having.join(' AND ')}`);
  }

  if (query.window) {
    const window: string[] = [];
    query.window.forEach((item) => {
      for (const key in item) {
        window.push(`${q(key)} AS ${windowToSql(quotedAs, item[key])}`);
      }
    });
    sql.push(`WINDOW ${window.join(', ')}`);
  }

  if (query.union) {
    query.union.forEach((item) => {
      sql.push(
        `${item.kind} ${isRaw(item.arg) ? getRaw(item.arg) : item.arg.toSql()}`,
      );
    });
  }

  if (query.order) {
    sql.push(
      `ORDER BY ${query.order
        .map((item) => orderByToSql(quotedAs, item))
        .join(', ')}`,
    );
  }

  const limit = query.take ? 1 : query.limit;
  if (limit) {
    sql.push(`LIMIT ${limit}`);
  }

  if (query.offset) {
    sql.push(`OFFSET ${query.offset}`);
  }

  if (query.for) {
    sql.push(`FOR ${query.for.map(getRaw).join(', ')}`);
  }

  return sql.join(' ');
};

const expressionToSql = <T extends Query>(
  quotedAs: string,
  expr: Expression<T>,
) => {
  return typeof expr === 'object' && isRaw(expr)
    ? getRaw(expr)
    : qc(quotedAs, expr as string);
};

const aggregateToSql = <T extends Query>(
  quotedAs: string,
  item: Aggregate<T>,
) => {
  const sql: string[] = [`${item.function}(`];

  const options = item.options || EMPTY_OBJECT;

  if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

  if (typeof item.arg === 'object') {
    if (Array.isArray(item.arg)) {
      sql.push(
        `${expressionToSql(quotedAs, item.arg[0])}, ${quote(item.arg[1])}`,
      );
    } else if (isRaw(item.arg)) {
      sql.push(expressionToSql(quotedAs, item.arg));
    } else {
      const args: string[] = [];
      for (const key in item.arg) {
        args.push(
          `${quote(key)}, ${expressionToSql(
            quotedAs,
            item.arg[key as keyof typeof item.arg] as unknown as Expression<T>,
          )}`,
        );
      }
      sql.push(args.join(', '));
    }
  } else {
    sql.push(expressionToSql(quotedAs, item.arg));
  }

  if (options.withinGroup) sql.push(') WITHIN GROUP (');
  else if (options.order) sql.push(' ');

  if (options.order) sql.push(`ORDER BY ${options.order}`);

  sql.push(')');

  if (options.as) sql.push(` AS ${q(options.as)}`);

  if (options.filter) sql.push(` FILTER (WHERE ${options.filter})`);

  if (options.over) {
    sql.push(` OVER ${windowToSql(quotedAs, options.over)}`);
  }

  return sql.join('');
};

const whereConditionsToSql = <T extends Query>(
  model: T,
  query: QueryData<T>,
  quotedAs: string,
  otherTableQuotedAs: string = quotedAs,
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
    and.forEach((item) => {
      if ('prototype' in item) {
        const query = item as Query;
        const sql = whereConditionsToSql(
          query,
          query.query || EMPTY_OBJECT,
          q(query.table),
        );
        if (sql.length) ands.push(`(${sql})`);
        return;
      }

      if (isRaw(item)) {
        ands.push(`(${getRaw(item)})`);
        return;
      }

      if (Array.isArray(item)) {
        const leftColumn = quoteFullColumn(quotedAs, item[0]);
        const rightColumn = quoteFullColumn(otherTableQuotedAs, item[2]);
        const op = item[1];
        ands.push(`${leftColumn} ${op} ${rightColumn}`);
        return;
      }

      for (const key in item) {
        const value = (item as Record<string, object>)[key];
        if (
          typeof value === 'object' &&
          value !== null &&
          value !== undefined
        ) {
          if (isRaw(value)) {
            ands.push(`${qc(quotedAs, key)} = ${getRaw(value)}`);
          } else {
            const column = model.schema.shape[key];
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
                operator(qc(quotedAs, key), value[op as keyof typeof value]),
              );
            }
          }
        } else {
          ands.push(
            `${qc(quotedAs, key)} ${value === null ? 'IS' : '='} ${quote(
              value,
            )}`,
          );
        }
      }
    });
    ors.push(ands.join(' AND '));
  });

  return ors.join(' OR ');
};

const windowToSql = <T extends Query>(
  quotedAs: string,
  window: T['windows'][number] | WindowDeclaration<T> | RawExpression,
) => {
  if (typeof window === 'object') {
    if (isRaw(window)) {
      return `(${getRaw(window)})`;
    } else {
      const sql: string[] = [];
      if (window.partitionBy) {
        sql.push(
          `PARTITION BY ${expressionToSql(quotedAs, window.partitionBy)}`,
        );
      }
      if (window.order) {
        sql.push(`ORDER BY ${orderByToSql(quotedAs, window.order)}`);
      }
      return `(${sql.join(' ')})`;
    }
  } else {
    return q(window as string);
  }
};

const orderByToSql = (quotedAs: string, order: OrderBy<Query>) => {
  if (isRaw(order)) {
    return getRaw(order);
  }

  const sql: string[] = [];
  for (const key in order) {
    const value = order[key];
    if (typeof value === 'string') {
      sql.push(`${qc(quotedAs, key)} ${value}`);
    } else if (value) {
      sql.push(`${qc(quotedAs, key)} ${value.dir} NULLS ${value.nulls}`);
    }
  }
  return sql.join(', ');
};
