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
} from 'orchid-core';
import { QueryResult } from '../adapter';

export type UpdateData<T extends Query> = {
  [K in keyof T['inputType']]?: T['inputType'][K] | RawExpression;
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

type UpdateRawArg<T extends Query> = T['meta']['hasWhere'] extends true
  ? RawExpression
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
        const encode = shape[key].encodeFn;
        if (encode) set[key] = encode(set[key]);
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

  updateRaw<T extends Query>(this: T, arg: UpdateRawArg<T>): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateRaw(arg);
  }
  _updateRaw<T extends Query>(this: T, arg: UpdateRawArg<T>): UpdateResult<T> {
    pushQueryValue(this, 'updateData', arg);
    return update(this);
  }

  updateOrThrow<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateOrThrow(arg);
  }

  _updateOrThrow<T extends Query>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    this.query.throwOnNotFound = true;
    return this._update(arg);
  }

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
