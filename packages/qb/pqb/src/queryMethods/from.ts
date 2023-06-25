import {
  Query,
  GetQueryResult,
  SelectableBase,
  SelectableFromShape,
  SetQueryTableAlias,
  WithDataItem,
} from '../query';
import { SelectQueryData } from '../sql';
import { AliasOrTable } from '../utils';
import {
  QueryCatch,
  QueryThen,
  Expression,
  TemplateLiteralArgs,
  isExpression,
} from 'orchid-core';
import { getShapeFromSelect } from './select';
import { RawSQL } from '../sql/rawSql';

export type FromArgs<T extends Query> =
  | [
      first: Query | Expression | Exclude<keyof T['withData'], symbol | number>,
      second?: { only?: boolean },
    ]
  | TemplateLiteralArgs;

export type FromResult<
  T extends Query,
  Args extends FromArgs<T>,
> = Args extends TemplateStringsArray
  ? T
  : Args[0] extends string
  ? T['withData'] extends Record<string, WithDataItem>
    ? Args[0] extends keyof T['withData']
      ? Omit<T, 'meta' | 'selectable'> & {
          meta: Omit<T['meta'], 'as'> & {
            as?: string;
          };
          selectable: SelectableFromShape<
            T['withData'][Args[0]]['shape'],
            Args[0]
          >;
        }
      : SetQueryTableAlias<T, Args[0]>
    : SetQueryTableAlias<T, Args[0]>
  : Args[0] extends Query
  ? FromQueryResult<T, Args[0]>
  : T;

type FromQueryResult<
  T extends Query,
  Q extends Query,
  Selectable extends SelectableBase = {
    [K in keyof Q['result']]: K extends string
      ? {
          as: K;
          column: Q['result'][K];
        }
      : never;
  },
  Data = GetQueryResult<T['returnType'], Q['result']>,
> = {
  [K in keyof T]: K extends 'meta'
    ? Omit<T['meta'], 'hasSelect' | 'as'> & { as: AliasOrTable<Q> }
    : K extends 'selectable'
    ? Selectable
    : K extends 'result' | 'shape'
    ? Q['result']
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

export class From {
  /**
   * Set the `FROM` value, by default the table name is used.
   *
   * ```ts
   * // accepts sub-query:
   * db.table.from(Otherdb.table.select('foo', 'bar'));
   *
   * // accepts raw sql by template literal:
   * const value = 123;
   * db.table.from`value = ${value}`;
   *
   * // accepts raw sql:
   * db.table.from(db.table.sql`value = ${value}`);
   *
   * // accepts alias of `WITH` expression:
   * q.with('foo', Otherdb.table.select('id', 'name')).from('foo');
   * ```
   *
   * Optionally takes a second argument of type `{ only?: boolean }`, (see `FROM ONLY` in Postgres docs, this is related to table inheritance).
   *
   * ```ts
   * db.table.from(Otherdb.table.select('foo', 'bar'), {
   *   only: true,
   * });
   * ```
   *
   * @param args - query, raw SQL, name of CTE table, or a template string
   */
  from<T extends Query, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    return this.clone()._from(...args) as FromResult<T, Args>;
  }
  _from<T extends Query, Args extends FromArgs<T>>(
    this: T,
    ...args: Args
  ): FromResult<T, Args> {
    if (Array.isArray(args[0])) {
      return this._from(new RawSQL(args as TemplateLiteralArgs)) as FromResult<
        T,
        Args
      >;
    }

    if (typeof args[0] === 'string') {
      this.query.as ||= args[0];
    } else if (!isExpression(args[0])) {
      const q = args[0] as Query;
      this.query.as ||= q.query.as || q.table || 't';
      this.query.shape = getShapeFromSelect(args[0] as Query, true);
      this.query.parsers = q.query.parsers;
    } else {
      this.query.as ||= 't';
    }

    const options = args[1] as { only?: boolean } | undefined;
    if (options?.only) {
      (this.query as SelectQueryData).fromOnly = options.only;
    }

    this.query.from = args[0] as Query;

    return this as unknown as FromResult<T, Args>;
  }
}
