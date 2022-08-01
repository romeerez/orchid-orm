import { AddQuerySelect, ColumnParser, Query } from '../query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  ColumnType,
} from '../columnSchema';
import { getQueryParsers, isRaw, RawExpression } from '../common';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { parseRecord } from './then';
import { QueryData } from '../sql';

type SelectResult<
  T extends Query,
  K extends (keyof T['selectable'])[],
  S extends Record<string, { as: string; column: ColumnType }> = Pick<
    T['selectable'],
    K[number]
  >,
> = AddQuerySelect<
  T,
  {
    [K in keyof S as S[K]['as']]: S[K]['column'];
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

const addParser = (query: QueryData, key: string, parser: ColumnParser) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser };
};

export class Select {
  select<T extends Query, K extends (keyof T['selectable'])[]>(
    this: T,
    ...columns: K
  ): SelectResult<T, K> {
    return this.clone()._select(...columns) as unknown as SelectResult<T, K>;
  }

  _select<T extends Query, K extends (keyof T['selectable'])[]>(
    this: T,
    ...columns: K
  ): SelectResult<T, K> {
    const q = this.toQuery();
    if (!columns.length) {
      return this as unknown as SelectResult<T, K>;
    }

    const as = q.query.as || q.table;
    columns.forEach((item) => {
      const index = (item as string).indexOf('.');
      if (index !== -1) {
        const table = (item as string).slice(0, index);
        const column = (item as string).slice(index + 1);

        if (table === as) {
          const parser = q.columnsParsers?.[column];
          if (parser) addParser(q.query, column, parser);
        } else {
          const parser = q.query.joinedParsers?.[table]?.[column];
          if (parser) addParser(q.query, column, parser);
        }
      } else {
        const parser = q.columnsParsers?.[item as string];
        if (parser) addParser(q.query, item as string, parser);
      }
    });

    return pushQueryArray(q, 'select', columns) as unknown as SelectResult<
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
    const q = this.toQuery();
    const as = q.query.as || q.table;
    for (const key in select) {
      const item = select[key];

      if (typeof item === 'object') {
        if (isRaw(item)) {
          const parser = item.__column?.parseFn;
          if (parser) addParser(q.query, key, parser);
        } else {
          const parsers = getQueryParsers(item);
          if (parsers) {
            if (item.query?.take) {
              addParser(q.query, key, (item) => parseRecord(parsers, item));
            } else {
              addParser(q.query, key, (items) =>
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
            if (parser) addParser(q.query, key, parser);
          } else {
            const parser = q.query.joinedParsers?.[table]?.[column];
            if (parser) addParser(q.query, key, parser);
          }
        } else {
          const parser = q.columnsParsers?.[item as string];
          if (parser) addParser(q.query, key, parser);
        }
      }
    }

    return pushQueryValue(q, 'select', {
      selectAs: select,
    }) as unknown as SelectAsResult<T, S>;
  }
}
