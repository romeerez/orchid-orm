import { AddQuerySelect, ColumnParser, Query, QueryBase } from '../query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  NullableColumn,
} from '../columnSchema';
import { getQueryParsers, isRaw, RawExpression } from '../common';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { parseRecord } from './then';
import { QueryData, SelectQueryData } from '../sql';
import { getQueryAs } from '../utils';
import { isRequiredRelationKey, RelationQueryBase } from '../relations';

type SelectArg<T extends QueryBase> = keyof T['selectable'] | RelationQueryBase;

type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
> = AddQuerySelect<
  T,
  {
    [Arg in Args[number] as Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['as']
      : Arg extends RelationQueryBase
      ? Arg['tableAlias'] extends string
        ? Arg['tableAlias']
        : never
      : never]: Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['column']
      : Arg extends RelationQueryBase
      ? Arg['returnType'] extends 'all'
        ? ArrayOfColumnsObjects<Arg['result']>
        : Arg[isRequiredRelationKey] extends true
        ? ColumnsObject<Arg['result']>
        : NullableColumn<ColumnsObject<Arg['result']>>
      : never;
  }
>;

type SelectAsArg<T extends Query> = Record<
  string,
  keyof T['selectable'] | Query | RawExpression
>;

type SelectAsResult<T extends Query, S extends SelectAsArg<T>> = AddQuerySelect<
  T,
  {
    [K in keyof S]: S[K] extends keyof T['selectable']
      ? T['selectable'][S[K]]['column']
      : S[K] extends RawExpression
      ? S[K]['__column']
      : S[K] extends Query
      ? S[K]['returnType'] extends 'all'
        ? ArrayOfColumnsObjects<S[K]['result']>
        : ColumnsObject<S[K]['result']>
      : never;
  }
>;

export const addParserForSelectItem = <T extends Query>(
  q: T,
  as: string | undefined,
  key: string,
  item: keyof T['selectable'] | Query | RawExpression,
) => {
  if (typeof item === 'object') {
    if (isRaw(item)) {
      const parser = item.__column?.parseFn;
      if (parser) addParserToQuery(q.query, key, parser);
    } else {
      const parsers = getQueryParsers(item);
      if (parsers) {
        if (item.query.take) {
          addParserToQuery(q.query, key, (item) => parseRecord(parsers, item));
        } else {
          addParserToQuery(q.query, key, (items) =>
            (items as unknown[]).map((item) => parseRecord(parsers, item)),
          );
        }
      }
    }
  } else {
    const index = (item as string).indexOf('.');
    if (index !== -1) {
      const table = (item as string).slice(0, index);
      const column = (item as string).slice(index + 1);

      if (table === as) {
        const parser = q.columnsParsers?.[column];
        if (parser) addParserToQuery(q.query, key, parser);
      } else {
        const parser = (q.query as SelectQueryData).joinedParsers?.[table]?.[
          column
        ];
        if (parser) addParserToQuery(q.query, key, parser);
      }
    } else {
      const parser = q.columnsParsers?.[item as string];
      if (parser) addParserToQuery(q.query, key, parser);
    }
  }
};

export const addParserToQuery = (
  query: QueryData,
  key: string,
  parser: ColumnParser,
) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser };
};

export class Select {
  select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    return this.clone()._select(...args) as unknown as SelectResult<T, K>;
  }

  _select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    if (!args.length) {
      return this as unknown as SelectResult<T, K>;
    }

    const as = this.query.as || this.table;
    args.forEach((item) => {
      if (typeof item === 'string') {
        const index = item.indexOf('.');
        if (index !== -1) {
          const table = item.slice(0, index);
          const column = item.slice(index + 1);

          if (table === as) {
            const parser = this.columnsParsers?.[column];
            if (parser) addParserToQuery(this.query, column, parser);
          } else {
            const parser = (this.query as SelectQueryData).joinedParsers?.[
              table
            ]?.[column];
            if (parser) addParserToQuery(this.query, column, parser);
          }
        } else {
          const parser = this.columnsParsers?.[item];
          if (parser) addParserToQuery(this.query, item, parser);
        }
      } else {
        const relation = item as RelationQueryBase;
        const parsers = relation.query.parsers || relation.columnsParsers;
        if (parsers) {
          addParserToQuery(this.query, getQueryAs(relation), (input) => {
            if (Array.isArray(input)) {
              input.forEach((record: unknown) => {
                for (const key in parsers) {
                  const value = (record as Record<string, unknown>)[key];
                  if (value !== null) {
                    (record as Record<string, unknown>)[key] =
                      parsers[key](value);
                  }
                }
              });
            } else {
              for (const key in parsers) {
                const value = (input as Record<string, unknown>)[key];
                if (value !== null) {
                  (input as Record<string, unknown>)[key] = parsers[key](value);
                }
              }
            }
            return input;
          });
        }
      }
    });

    return pushQueryArray(this, 'select', args) as unknown as SelectResult<
      T,
      K
    >;
  }

  selectAs<T extends Query, S extends SelectAsArg<T>>(
    this: T,
    select: S,
  ): SelectAsResult<T, S> {
    return this.clone()._selectAs(select) as unknown as SelectAsResult<T, S>;
  }

  _selectAs<T extends Query, S extends SelectAsArg<T>>(
    this: T,
    select: S,
  ): SelectAsResult<T, S> {
    const as = this.query.as || this.table;
    for (const key in select) {
      addParserForSelectItem(this, as, key, select[key]);
    }

    return pushQueryValue(this, 'select', {
      selectAs: select,
    }) as unknown as SelectAsResult<T, S>;
  }
}
