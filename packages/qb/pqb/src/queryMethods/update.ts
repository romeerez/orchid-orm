import { Query, QueryReturnsAll, SetQueryReturnsRowCount } from '../query';
import { pushQueryValue } from '../queryDataUtils';
import {
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  Relation,
} from '../relations';
import { WhereArg, WhereResult } from './where';
import { CreateData } from './create';
import { queryMethodByReturnType } from './then';
import { UpdateQueryData } from '../sql';
import { VirtualColumn } from '../columns';
import { anyShape } from '../db';
import {
  isRaw,
  RawExpression,
  EmptyObject,
  MaybeArray,
  StringKey,
  raw,
  QueryThen,
} from 'orchid-core';
import { QueryResult } from '../adapter';

export type UpdateData<T extends Query> = {
  [K in keyof T['inputType']]?: UpdateColumn<T, K>;
} & (T['relations'] extends Record<string, Relation>
  ? {
      [K in keyof T['relations']]?: T['relations'][K] extends BelongsToRelation
        ? UpdateBelongsToData<T, T['relations'][K]>
        : T['relations'][K] extends HasOneRelation
        ? UpdateHasOneData<T, T['relations'][K]>
        : T['relations'][K] extends HasManyRelation
        ? UpdateHasManyData<T, T['relations'][K]>
        : T['relations'][K] extends HasAndBelongsToManyRelation
        ? UpdateHasAndBelongsToManyData<T['relations'][K]>
        : never;
    }
  : EmptyObject) & {
    __raw?: never; // forbid RawExpression argument
  };

type UpdateColumn<
  T extends Query,
  Key extends keyof T['inputType'],
  SubQuery = {
    [K in keyof Query]: K extends 'then'
      ? QueryThen<T['inputType'][Key]>
      : Query[K];
  },
> = T['inputType'][Key] | RawExpression | SubQuery | ((q: T) => SubQuery);

type UpdateBelongsToData<T extends Query, Rel extends BelongsToRelation> =
  | { disconnect: boolean }
  | { set: WhereArg<Rel['table']> }
  | { delete: boolean }
  | { update: UpdateData<Rel['table']> }
  | {
      create: CreateData<Rel['nestedCreateQuery']>;
    }
  | (QueryReturnsAll<T['returnType']> extends true
      ? never
      : {
          upsert: {
            update: UpdateData<Rel['table']>;
            create:
              | CreateData<Rel['nestedCreateQuery']>
              | (() => CreateData<Rel['nestedCreateQuery']>);
          };
        });

type UpdateHasOneData<T extends Query, Rel extends HasOneRelation> =
  | { disconnect: boolean }
  | { delete: boolean }
  | { update: UpdateData<Rel['table']> }
  | (QueryReturnsAll<T['returnType']> extends true
      ? never
      :
          | { set: WhereArg<Rel['table']> }
          | {
              upsert: {
                update: UpdateData<Rel['table']>;
                create:
                  | CreateData<Rel['nestedCreateQuery']>
                  | (() => CreateData<Rel['nestedCreateQuery']>);
              };
            }
          | {
              create: CreateData<Rel['nestedCreateQuery']>;
            });

type UpdateHasManyData<T extends Query, Rel extends HasManyRelation> = {
  disconnect?: MaybeArray<WhereArg<Rel['table']>>;
  delete?: MaybeArray<WhereArg<Rel['table']>>;
  update?: {
    where: MaybeArray<WhereArg<Rel['table']>>;
    data: UpdateData<Rel['table']>;
  };
} & (QueryReturnsAll<T['returnType']> extends true
  ? EmptyObject
  : {
      set?: MaybeArray<WhereArg<Rel['table']>>;
      create?: CreateData<Rel['nestedCreateQuery']>[];
    });

type UpdateHasAndBelongsToManyData<Rel extends HasAndBelongsToManyRelation> = {
  disconnect?: MaybeArray<WhereArg<Rel['table']>>;
  set?: MaybeArray<WhereArg<Rel['table']>>;
  delete?: MaybeArray<WhereArg<Rel['table']>>;
  update?: {
    where: MaybeArray<WhereArg<Rel['table']>>;
    data: UpdateData<Rel['table']>;
  };
  create?: CreateData<Rel['nestedCreateQuery']>[];
};

type UpdateArg<T extends Query> = T['meta']['hasWhere'] extends true
  ? UpdateData<T>
  : never;

type UpdateRawArgs<T extends Query> = T['meta']['hasWhere'] extends true
  ? [sql: RawExpression] | [TemplateStringsArray, ...unknown[]]
  : never;

type UpdateResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? T
  : SetQueryReturnsRowCount<T>;

type ChangeCountArg<T extends Query> =
  | keyof T['shape']
  | Partial<Record<keyof T['shape'], number>>;

export type UpdateCtx = {
  willSetKeys?: true;
  returnTypeAll?: true;
  resultAll: Record<string, unknown>[];
  queries?: ((queryResult: QueryResult) => Promise<void>)[];
  updateData?: Record<string, unknown>;
};

const applyCountChange = <T extends Query>(
  self: T,
  op: string,
  data: ChangeCountArg<T>,
) => {
  self.query.type = 'update';

  let map: Record<string, { op: string; arg: number }>;
  if (typeof data === 'object') {
    map = {};
    for (const key in data) {
      map[key] = { op, arg: data[key] as number };
    }
  } else {
    map = { [data as string]: { op, arg: 1 } };
  }

  pushQueryValue(self, 'updateData', map);
  return self as unknown as UpdateResult<T>;
};

const checkIfUpdateIsEmpty = (q: UpdateQueryData) => {
  return !q.updateData?.some((item) => isRaw(item) || Object.keys(item).length);
};

const update = <T extends Query>(q: T): UpdateResult<T> => {
  const { query } = q;
  query.type = 'update';

  if (!query.select) {
    query.returnType = 'rowCount';
  }

  return q as unknown as UpdateResult<T>;
};

export class Update {
  /**
   * `.update` takes an object with columns and values to update records.
   *
   * By default, `.update` will return a count of updated records.
   *
   * Place `.select`, `.selectAll`, or `.get` before `.update` to specify returning columns.
   *
   * You need to provide `.where`, `.findBy`, or `.find` conditions before calling `.update`.
   * To ensure that the whole table won't be updated by accident, updating without where conditions will result in TypeScript and runtime errors.
   *
   * If you need to update ALL records, use `where` method without arguments:
   *
   * ```ts
   * await db.table.where().update({ name: 'new name' });
   * ```
   *
   * If `.select` and `.where` were specified before the update it will return an array of updated records.
   *
   * If `.select` and `.take`, `.find`, or similar were specified before the update it will return one updated record.
   *
   * For a column value you can provide a specific value, raw SQL, a query object that returns a single value, or a callback with a sub-query.
   *
   * ```ts
   * // returns number of updated records by default
   * const updatedCount = await db.table
   *   .where({ name: 'old name' })
   *   .update({ name: 'new name' });
   *
   * // returning only `id`
   * const id = await db.table.find(1).get('id').update({ name: 'new name' });
   *
   * // `selectAll` + `find` will return a full record
   * const oneFullRecord = await db.table
   *   .selectAll()
   *   .find(1)
   *   .update({ name: 'new name' });
   *
   * // `selectAll` + `where` will return array of full records
   * const recordsArray = await db.table
   *   .select('id', 'name')
   *   .where({ id: 1 })
   *   .update({ name: 'new name' });
   *
   * await db.table.where({ ...conditions }).update({
   *   // set the column to a specific value
   *   column1: 123,
   *
   *   // use raw SQL to update the column
   *   column2: db.table.sql`2 + 2`,
   *
   *   // use query that returns a single value
   *   // returning multiple values will result in PostgreSQL error
   *   column3: db.otherTable.get('someColumn').take(),
   *
   *   // select a single value from a related record
   *   column4: (q) => q.relatedTable.get('someColumn'),
   * });
   * ```
   *
   * `null` value will set a column to `NULL`, but the `undefined` value will be ignored:
   *
   * ```ts
   * db.table.findBy({ id: 1 }).update({
   *   name: null, // updates to null
   *   age: undefined, // skipped, no effect
   * });
   * ```
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  update<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const q = this.clone() as T;
    return q._update(arg);
  }
  _update<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const { query } = this;

    const set: Record<string, unknown> = { ...arg };
    pushQueryValue(this, 'updateData', set);

    const { shape } = this.query;

    const originalReturnType = query.returnType || 'all';

    const ctx: UpdateCtx = {
      resultAll: undefined as unknown as Record<string, unknown>[],
    };

    for (const key in arg) {
      const item = shape[key];
      if (item instanceof VirtualColumn && item.update) {
        item.update(this, ctx, set);
        delete set[key];
      } else if (!shape[key] && shape !== anyShape) {
        delete set[key];
      } else {
        const value = set[key];
        if (
          typeof value !== 'function' &&
          (typeof value !== 'object' || !value || !isRaw(value))
        ) {
          const encode = shape[key].encodeFn;
          if (encode) set[key] = encode(value);
        }
      }
    }

    if (!ctx.willSetKeys && checkIfUpdateIsEmpty(query as UpdateQueryData)) {
      delete query.type;
    }

    const { queries } = ctx;
    if (queries || ctx.returnTypeAll) {
      query.returnType = 'all';

      if (queries) {
        if (!query.select?.includes('*')) {
          this.primaryKeys.forEach((key) => {
            if (!query.select?.includes(key)) {
              this._select(key as StringKey<keyof T['selectable']>);
            }
          });
        }

        query.patchResult = async (queryResult) => {
          await Promise.all(queries.map((fn) => fn(queryResult)));

          if (ctx.updateData) {
            const t = this.baseQuery.clone();
            const keys = this.primaryKeys;
            (
              t._whereIn as unknown as (
                keys: string[],
                values: unknown[][],
              ) => Query
            )(
              keys,
              queryResult.rows.map((item) => keys.map((key) => item[key])),
            );

            await (t as WhereResult<Query>)._update(ctx.updateData);

            for (const row of queryResult.rows) {
              Object.assign(row, ctx.updateData);
            }
          }
        };
      }

      const { handleResult } = query;
      query.handleResult = (q, queryResult, s) => {
        // handleResult is mutating queryResult.rows
        // we're using twice here: first, for ctx.resultAll that's used in relations
        // and second time to parse result that user is expecting, so the rows are cloned
        const originalRows = queryResult.rows;
        queryResult.rows = [...originalRows];
        ctx.resultAll = handleResult(q, queryResult) as Record<
          string,
          unknown
        >[];

        if (queryMethodByReturnType[originalReturnType] === 'arrays') {
          originalRows.forEach(
            (row, i) =>
              ((originalRows as unknown as unknown[][])[i] =
                Object.values(row)),
          );
        }

        q.query.returnType = originalReturnType;

        queryResult.rows = originalRows;
        return handleResult(q, queryResult, s);
      };
    }

    return update(this);
  }

  /**
   * `updateRaw` is for updating records with raw expression.
   *
   * The behavior is the same as a regular `update` method has:
   * `find` or `where` must precede calling this method,
   * it returns an updated count by default,
   * you can customize returning data by using `select`.
   *
   * ```ts
   * const value = 'new name';
   *
   * // update with SQL template string
   * const updatedCount = await db.table.find(1).updateRaw`name = ${value}`;
   *
   * // or update with `sql` function:
   * await db.table.find(1).updateRaw(db.table.sql`name = ${value}`);
   * ```
   * @param args - raw SQL via a template string or by using a `sql` method
   */
  updateRaw<T extends Query>(
    this: T,
    ...args: UpdateRawArgs<T>
  ): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateRaw(...args);
  }
  _updateRaw<T extends Query>(
    this: T,
    ...args: UpdateRawArgs<T>
  ): UpdateResult<T> {
    if (Array.isArray(args[0])) {
      const sql = raw(args as [TemplateStringsArray, ...unknown[]]);
      return (this as T & { meta: { hasWhere: true } })._updateRaw(sql);
    }

    pushQueryValue(this, 'updateData', args[0]);
    return update(this);
  }

  /**
   * To make sure that at least one row was updated use `updateOrThrow`:
   *
   * ```ts
   * import { NotFoundError } from 'pqb';
   *
   * try {
   *   // updatedCount is guaranteed to be greater than 0
   *   const updatedCount = await db.table
   *     .where(conditions)
   *     .updateOrThrow({ name: 'name' });
   *
   *   // updatedRecords is guaranteed to be a non-empty array
   *   const updatedRecords = await db.table
   *     .where(conditions)
   *     .select('id')
   *     .updateOrThrow({ name: 'name' });
   * } catch (err) {
   *   if (err instanceof NotFoundError) {
   *     // handle error
   *   }
   * }
   * ```
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  updateOrThrow<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateOrThrow(arg);
  }

  _updateOrThrow<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    this.query.throwOnNotFound = true;
    return this._update(arg);
  }

  /**
   * Increments a column value by the specified amount. Optionally takes `returning` argument.
   *
   * ```ts
   * // increment numericColumn column by 1, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .increment('numericColumn');
   *
   * // increment someColumn by 5 and otherColumn by 10, return updated records
   * const result2 = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .increment({
   *     someColumn: 5,
   *     otherColumn: 10,
   *   });
   * ```
   *
   * @param data - name of the column to increment, or an object with columns and values to add
   */
  increment<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return this.clone()._increment(data) as unknown as UpdateResult<T>;
  }

  _increment<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return applyCountChange(this, '+', data);
  }

  /**
   * Decrements a column value by the specified amount. Optionally takes `returning` argument.
   *
   * ```ts
   * // decrement numericColumn column by 1, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .decrement('numericColumn');
   *
   * // decrement someColumn by 5 and otherColumn by 10, return updated records
   * const result2 = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .decrement({
   *     someColumn: 5,
   *     otherColumn: 10,
   *   });
   * ```
   *
   * @param data - name of the column to decrement, or an object with columns and values to subtract
   */
  decrement<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return this.clone()._decrement(data) as unknown as UpdateResult<T>;
  }

  _decrement<T extends Query>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return applyCountChange(this, '-', data);
  }
}
