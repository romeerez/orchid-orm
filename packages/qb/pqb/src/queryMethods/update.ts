import { Query, QueryReturnsAll, SetQueryReturnsRowCount } from '../query';
import { pushQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression } from '../raw';
import {
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  Relation,
} from '../relations';
import { WhereArg, WhereResult } from './where';
import { EmptyObject, MaybeArray, StringKey } from '../utils';
import { CreateData } from './create';
import { parseResult, queryMethodByReturnType } from './then';
import { UpdateQueryData } from '../sql';
import { ColumnsShape, VirtualColumn } from '../columns';
import { anyShape } from '../db';

export type UpdateData<T extends Query> = {
  [K in keyof T['type']]?: T['type'][K] | RawExpression;
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
            create: CreateData<Rel['nestedCreateQuery']>;
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
                create: CreateData<Rel['nestedCreateQuery']>;
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

type UpdateArg<T extends Query> = T['hasWhere'] extends true
  ? UpdateData<T>
  : never;

type UpdateRawArg<T extends Query> = T['hasWhere'] extends true
  ? RawExpression
  : never;

type UpdateResult<T extends Query> = T['hasSelect'] extends true
  ? T
  : SetQueryReturnsRowCount<T>;

type ChangeCountArg<T extends Query> =
  | keyof T['shape']
  | Partial<Record<keyof T['shape'], number>>;

export type UpdateCtx = {
  willSetKeys?: true;
  updateLater?: Record<string, unknown>;
  updateLaterPromises?: Promise<void>[];
  returnTypeAll?: true;
  resultAll: Record<string, unknown>[];
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

    const { shape } = this as { shape: ColumnsShape };

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

    if (ctx.updateLater) {
      if (!query.select?.includes('*')) {
        this.primaryKeys.forEach((key) => {
          if (!query.select?.includes(key)) {
            this._select(key as StringKey<keyof T['selectable']>);
          }
        });
      }
    }

    if (ctx.updateLater || ctx.returnTypeAll) {
      query.returnType = 'all';

      const { handleResult } = query;
      query.handleResult = async (q, queryResult) => {
        ctx.resultAll = (await handleResult(q, queryResult)) as Record<
          string,
          unknown
        >[];

        if (ctx.updateLater) {
          await Promise.all(ctx.updateLaterPromises as Promise<void>[]);

          const t = this.baseQuery.clone().transacting(q);
          const keys = this.primaryKeys;
          (
            t._whereIn as unknown as (
              keys: string[],
              values: unknown[][],
            ) => Query
          )(
            keys,
            ctx.resultAll.map((item) => keys.map((key) => item[key])),
          );

          await (t as WhereResult<Query>)._update(ctx.updateLater);

          ctx.resultAll.forEach((item) => Object.assign(item, ctx.updateLater));
        }

        if (queryMethodByReturnType[originalReturnType] === 'arrays') {
          queryResult.rows.forEach(
            (row, i) =>
              ((queryResult.rows as unknown as unknown[][])[i] =
                Object.values(row)),
          );
        }

        q.query.returnType = originalReturnType;

        return parseResult(q, originalReturnType, queryResult);
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
