import {
  AddQuerySelect,
  ColumnParser,
  ColumnsParsers,
  Query,
  QueryBase,
  QuerySelectAll,
} from '../query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  NullableColumn,
} from '../columnSchema';
import { getQueryParsers, isRaw, RawExpression } from '../common';
import { pushQueryArray } from '../queryDataUtils';
import { parseRecord } from './then';
import { QueryData, SelectItem, SelectQueryData } from '../sql';
import { FilterTuple, getQueryAs, SimpleSpread } from '../utils';
import {
  isRequiredRelationKey,
  Relation,
  RelationQueryBase,
  relationQueryKey,
} from '../relations';
import { getValueKey } from './get';

export type SelectArg<T extends QueryBase> =
  | keyof T['selectable']
  | (T['relations'] extends Record<string, Relation>
      ? keyof T['relations']
      : never)
  | RelationQueryBase
  | SelectAsArg<T>;

type SelectAsArg<T extends QueryBase> = Record<
  string,
  keyof T['selectable'] | Query | RawExpression
>;

type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
  SelectAsArgs = SimpleSpread<FilterTuple<Args, SelectAsArg<QueryBase>>>,
> = AddQuerySelect<
  T,
  {
    [Arg in Args[number] as Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['as']
      : Arg extends keyof T['relations']
      ? Arg
      : Arg extends RelationQueryBase
      ? Arg['tableAlias'] extends string
        ? Arg['tableAlias']
        : never
      : never]: Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['column']
      : Arg extends RelationQueryBase
      ? Arg['returnType'] extends 'all'
        ? ArrayOfColumnsObjects<Arg['result']>
        : Arg['returnType'] extends 'valueOrThrow'
        ? Arg['result']['value']
        : Arg[isRequiredRelationKey] extends true
        ? ColumnsObject<Arg['result']>
        : NullableColumn<ColumnsObject<Arg['result']>>
      : T['relations'] extends Record<string, Relation>
      ? Arg extends keyof T['relations']
        ? T['relations'][Arg]['returns'] extends 'many'
          ? ArrayOfColumnsObjects<T['relations'][Arg]['model']['result']>
          : T['relations'][Arg]['options']['required'] extends true
          ? ColumnsObject<T['relations'][Arg]['model']['result']>
          : NullableColumn<
              ColumnsObject<T['relations'][Arg]['model']['result']>
            >
        : never
      : never;
  } & {
    [K in keyof SelectAsArgs]: SelectAsArgs[K] extends keyof T['selectable']
      ? T['selectable'][SelectAsArgs[K]]['column']
      : SelectAsArgs[K] extends RawExpression
      ? SelectAsArgs[K]['__column']
      : SelectAsArgs[K] extends Query
      ? SelectAsArgs[K]['returnType'] extends 'all'
        ? ArrayOfColumnsObjects<SelectAsArgs[K]['result']>
        : ColumnsObject<SelectAsArgs[K]['result']>
      : never;
  }
>;

export const addParserForRawExpression = (
  q: Query,
  key: string | getValueKey,
  raw: RawExpression,
) => {
  const parser = raw.__column?.parseFn;
  if (parser) addParserToQuery(q.query, key, parser);
};

export const addParserForSelectItem = <T extends Query>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  item: keyof T['selectable'] | Query | RawExpression,
) => {
  if (typeof item === 'object') {
    if (isRaw(item)) {
      addParserForRawExpression(q, key, item);
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
  key: string | getValueKey,
  parser: ColumnParser,
) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser } as ColumnsParsers;
};

export const processSelectArg = <T extends Query>(
  q: T,
  as: string | undefined,
  item: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem => {
  if (typeof item === 'string') {
    if ((q.relations as Record<string, Relation>)[item]) {
      item = (q as unknown as Record<string, RelationQueryBase>)[item];
    } else {
      const index = item.indexOf('.');
      if (index !== -1) {
        const table = item.slice(0, index);
        const column = item.slice(index + 1);

        if (table === as) {
          const parser = q.columnsParsers?.[column];
          if (parser) addParserToQuery(q.query, columnAs || column, parser);
        } else {
          const parser = (q.query as SelectQueryData).joinedParsers?.[table]?.[
            column
          ];
          if (parser) addParserToQuery(q.query, columnAs || column, parser);
        }
      } else {
        const parser = q.columnsParsers?.[item];
        if (parser) addParserToQuery(q.query, columnAs || item, parser);
      }
      return item;
    }
  }

  if ((item as { query?: QueryData }).query?.[relationQueryKey]) {
    const relation = item as RelationQueryBase;
    const parsers = relation.query.parsers || relation.columnsParsers;
    if (parsers) {
      addParserToQuery(q.query, getQueryAs(relation), (input) => {
        if (Array.isArray(input)) {
          input.forEach((record: unknown) => {
            for (const key in parsers) {
              const value = (record as Record<string, unknown>)[key];
              if (value !== null) {
                (record as Record<string, unknown>)[key] = parsers[key](value);
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
  } else {
    for (const key in item as SelectAsArg<QueryBase>) {
      addParserForSelectItem(q, as, key, (item as SelectAsArg<QueryBase>)[key]);
    }

    return { selectAs: item } as SelectItem;
  }

  return item as SelectItem;
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
    const selectArgs = args.map((item) => processSelectArg(this, as, item));

    return pushQueryArray(
      this,
      'select',
      selectArgs,
    ) as unknown as SelectResult<T, K>;
  }

  selectAll<T extends Query>(this: T): QuerySelectAll<T> {
    return this.clone()._selectAll();
  }

  _selectAll<T extends Query>(this: T): QuerySelectAll<T> {
    this.query.select = ['*'];
    return this as unknown as QuerySelectAll<T>;
  }
}
