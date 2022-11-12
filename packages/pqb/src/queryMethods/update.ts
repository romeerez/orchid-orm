import { Query, QueryReturnsAll, SetQueryReturnsRowCount } from '../query';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression, StringKey } from '../common';
import {
  BelongsToNestedUpdate,
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneNestedUpdate,
  HasOneRelation,
  NestedUpdateItem,
  NestedUpdateOneItem,
  Relation,
} from '../relations';
import { WhereArg, WhereResult } from './where';
import { EmptyObject, MaybeArray } from '../utils';
import { CreateData } from './create';
import { parseResult, queryMethodByReturnType } from './then';
import { UpdateQueryData } from '../sql';
import { ColumnsShape } from '../columnSchema';
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
  | { set: WhereArg<Rel['model']> }
  | { delete: boolean }
  | { update: UpdateData<Rel['model']> }
  | {
      create: CreateData<Rel['nestedCreateQuery']>;
    }
  | (QueryReturnsAll<T['returnType']> extends true
      ? never
      : {
          upsert: {
            update: UpdateData<Rel['model']>;
            create: CreateData<Rel['nestedCreateQuery']>;
          };
        });

type UpdateHasOneData<T extends Query, Rel extends HasOneRelation> =
  | { disconnect: boolean }
  | { delete: boolean }
  | { update: UpdateData<Rel['model']> }
  | (QueryReturnsAll<T['returnType']> extends true
      ? never
      :
          | { set: WhereArg<Rel['model']> }
          | {
              upsert: {
                update: UpdateData<Rel['model']>;
                create: CreateData<Rel['nestedCreateQuery']>;
              };
            }
          | {
              create: CreateData<Rel['nestedCreateQuery']>;
            });

type UpdateHasManyData<T extends Query, Rel extends HasManyRelation> = {
  disconnect?: MaybeArray<WhereArg<Rel['model']>>;
  delete?: MaybeArray<WhereArg<Rel['model']>>;
  update?: {
    where: MaybeArray<WhereArg<Rel['model']>>;
    data: UpdateData<Rel['model']>;
  };
} & (QueryReturnsAll<T['returnType']> extends true
  ? EmptyObject
  : {
      set?: MaybeArray<WhereArg<Rel['model']>>;
      create?: CreateData<Rel['nestedCreateQuery']>[];
    });

type UpdateHasAndBelongsToManyData<Rel extends HasAndBelongsToManyRelation> = {
  disconnect?: MaybeArray<WhereArg<Rel['model']>>;
  set?: MaybeArray<WhereArg<Rel['model']>>;
  delete?: MaybeArray<WhereArg<Rel['model']>>;
  update?: {
    where: MaybeArray<WhereArg<Rel['model']>>;
    data: UpdateData<Rel['model']>;
  };
  create?: CreateData<Rel['nestedCreateQuery']>[];
};

type UpdateArgs<T extends Query, ForceAll extends boolean> = (
  T['hasWhere'] extends true ? true : ForceAll
) extends true
  ? [update: UpdateData<T>]
  : [update: UpdateData<T>, forceAll: true];

type UpdateRawArgs<T extends Query, ForceAll extends boolean> = (
  T['hasWhere'] extends true ? true : ForceAll
) extends true
  ? [update: RawExpression]
  : [update: RawExpression, forceAll: true];

type UpdateResult<T extends Query> = T['hasSelect'] extends true
  ? T
  : SetQueryReturnsRowCount<T>;

type ChangeCountArg<T extends Query> =
  | keyof T['shape']
  | Partial<Record<keyof T['shape'], number>>;

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

const update = <T extends Query>(q: T, forceAll: boolean): UpdateResult<T> => {
  const { query } = q;
  query.type = 'update';

  if (!query.and?.length && !query.or?.length && !forceAll) {
    throw new Error('No where conditions or forceAll flag provided to update');
  }

  if (!query.select) {
    query.returnType = 'rowCount';
  }

  return q as unknown as UpdateResult<T>;
};

export class Update {
  update<T extends Query, ForceAll extends boolean = false>(
    this: T,
    ...args: UpdateArgs<T, ForceAll>
  ): UpdateResult<T> {
    const q = this.clone() as T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return q._update(...(args as any));
  }
  _update<T extends Query, ForceAll extends boolean = false>(
    this: T,
    ...args: UpdateArgs<T, ForceAll>
  ): UpdateResult<T> {
    const { query } = this;
    const data = args[0];

    const set: Record<string, unknown> = { ...data };
    pushQueryValue(this, 'updateData', set);

    const { relations, shape } = this as {
      relations: Record<string, Relation>;
      shape: ColumnsShape;
    };

    const prependRelations: Record<string, Record<string, unknown>> = {};
    const appendRelations: Record<string, Record<string, unknown>> = {};

    const originalReturnType = query.returnType || 'all';

    for (const key in data) {
      if (relations[key]) {
        delete set[key];
        if (relations[key].type === 'belongsTo') {
          prependRelations[key] = data[key] as Record<string, unknown>;
        } else {
          const value = data[key] as NestedUpdateItem;

          if (
            !value.set &&
            !('upsert' in value) &&
            (!value.disconnect ||
              (Array.isArray(value.disconnect) &&
                value.disconnect.length === 0)) &&
            (!value.delete ||
              (Array.isArray(value.delete) && value.delete.length === 0)) &&
            (!value.update ||
              (Array.isArray(value.update.where) &&
                value.update.where.length === 0)) &&
            (!value.create ||
              (Array.isArray(value.create) && value.create.length === 0))
          )
            continue;

          if (!query.select?.includes('*')) {
            const primaryKey = relations[key].primaryKey;
            if (!query.select?.includes(primaryKey)) {
              this._select(primaryKey as StringKey<keyof T['selectable']>);
            }
          }
          appendRelations[key] = data[key] as Record<string, unknown>;
        }
      } else if (!shape[key] && shape !== anyShape) {
        delete set[key];
      } else {
        const encode = shape[key].encodeFn;
        if (encode) set[key] = encode(set[key]);
      }
    }

    const state: {
      updateLater?: Record<string, unknown>;
      updateLaterPromises?: Promise<void>[];
    } = {};

    const prependRelationKeys = Object.keys(prependRelations);
    let willSetKeys = false;
    if (prependRelationKeys.length) {
      willSetKeys = prependRelationKeys.some((relationName) => {
        const data = prependRelations[relationName] as NestedUpdateOneItem;

        return (
          relations[relationName] as {
            nestedUpdate: BelongsToNestedUpdate;
          }
        ).nestedUpdate(this, set, data, state);
      });
    }

    if (!willSetKeys && checkIfUpdateIsEmpty(query as UpdateQueryData)) {
      delete query.type;
    }

    const appendRelationKeys = Object.keys(appendRelations);

    let resultOfTypeAll: Record<string, unknown>[] | undefined;

    if (
      state?.updateLater ||
      (appendRelationKeys.length && originalReturnType !== 'all')
    ) {
      query.returnType = 'all';

      if (state?.updateLater) {
        if (!query.select?.includes('*')) {
          this.primaryKeys.forEach((key) => {
            if (!query.select?.includes(key)) {
              this._select(key as StringKey<keyof T['selectable']>);
            }
          });
        }
      }

      const { handleResult } = query;
      query.handleResult = async (q, queryResult) => {
        resultOfTypeAll = (await handleResult(q, queryResult)) as Record<
          string,
          unknown
        >[];

        if (state?.updateLater) {
          await Promise.all(state.updateLaterPromises as Promise<void>[]);

          const t = this.__model.clone().transacting(q);
          const keys = this.primaryKeys;
          (
            t._whereIn as unknown as (
              keys: string[],
              values: unknown[][],
            ) => Query
          )(
            keys,
            resultOfTypeAll.map((item) => keys.map((key) => item[key])),
          );

          await (t as WhereResult<Query>)._update(state.updateLater);

          resultOfTypeAll.forEach((item) =>
            Object.assign(item, state.updateLater),
          );
        }

        if (queryMethodByReturnType[originalReturnType] === 'arrays') {
          queryResult.rows.forEach(
            (row, i) =>
              ((queryResult.rows as unknown as unknown[][])[i] =
                Object.values(row)),
          );
        }

        return parseResult(q, originalReturnType, queryResult);
      };
    }

    if (appendRelationKeys.length) {
      pushQueryArray(
        this,
        'afterQuery',
        appendRelationKeys.map((relationName) => {
          return (q: Query, result: Record<string, unknown>[]) => {
            const all = resultOfTypeAll || result;

            if (q.query.returnType !== originalReturnType) {
              q.query.returnType = originalReturnType;
            }

            return (
              relations[relationName].nestedUpdate as HasOneNestedUpdate
            )?.(q, all, appendRelations[relationName] as NestedUpdateOneItem);
          };
        }),
      );
    }

    if (prependRelationKeys.length || appendRelationKeys.length) {
      query.wrapInTransaction = true;
    }

    return update(this, (args as [unknown, boolean])[1]);
  }

  updateRaw<T extends Query, ForceAll extends boolean = false>(
    this: T,
    ...args: UpdateRawArgs<T, ForceAll>
  ): UpdateResult<T> {
    const q = this.clone() as T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return q._updateRaw(...(args as any));
  }
  _updateRaw<T extends Query, ForceAll extends boolean = false>(
    this: T,
    ...args: UpdateRawArgs<T, ForceAll>
  ): UpdateResult<T> {
    pushQueryValue(this, 'updateData', args[0]);
    return update(this, (args as [unknown, boolean])[1]);
  }

  updateOrThrow<T extends Query, ForceAll extends boolean = false>(
    this: T,
    ...args: UpdateArgs<T, ForceAll>
  ): UpdateResult<T> {
    const q = this.clone() as T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return q._updateOrThrow(...(args as any));
  }

  _updateOrThrow<T extends Query, ForceAll extends boolean = false>(
    this: T,
    ...args: UpdateArgs<T, ForceAll>
  ): UpdateResult<T> {
    this.query.throwOnNotFound = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this._update(...(args as any)) as unknown as UpdateResult<T>;
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
