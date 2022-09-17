import { Query, SetQueryReturnsRowCount } from '../query';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression } from '../common';
import {
  BelongsToNestedUpdate,
  HasOneNestedUpdate,
  NestedUpdateOneItem,
  Relation,
} from '../relations';
import { WhereArg, WhereResult } from './where';
import { MaybeArray } from '../utils';
import { InsertData } from './insert';

export type UpdateData<T extends Query> = {
  [K in keyof T['type']]?: T['type'][K] | RawExpression;
} & (T['relations'] extends Record<string, Relation>
  ? {
      [K in keyof T['relations']]?: T['relations'][K]['type'] extends 'belongsTo'
        ?
            | { disconnect: boolean }
            | { set: WhereArg<T['relations'][K]['model']> }
            | { delete: boolean }
            | { update: UpdateData<T['relations'][K]['model']> }
            | {
                upsert: {
                  update: UpdateData<T['relations'][K]['model']>;
                  create: InsertData<T['relations'][K]['nestedCreateQuery']>;
                };
              }
        : T['relations'][K]['type'] extends 'hasOne'
        ?
            | { disconnect: boolean }
            | (T['returnType'] extends 'one' | 'oneOrThrow'
                ? { set: WhereArg<T['relations'][K]['model']> }
                : never)
            | { delete: boolean }
            | { update: UpdateData<T['relations'][K]['model']> }
            | {
                upsert: {
                  update: UpdateData<T['relations'][K]['model']>;
                  create: InsertData<T['relations'][K]['nestedCreateQuery']>;
                };
              }
        : T['relations'][K]['type'] extends 'hasMany'
        ?
            | { disconnect: MaybeArray<WhereArg<T['relations'][K]['model']>> }
            | (T['returnType'] extends 'one' | 'oneOrThrow'
                ? { set: MaybeArray<WhereArg<T['relations'][K]['model']>> }
                : never)
            | { delete: MaybeArray<WhereArg<T['relations'][K]['model']>> }
            | {
                update: {
                  where: MaybeArray<WhereArg<T['relations'][K]['model']>>;
                  data: UpdateData<T['relations'][K]['model']>;
                };
              }
        : T['relations'][K]['type'] extends 'hasAndBelongsToMany'
        ?
            | { disconnect: MaybeArray<WhereArg<T['relations'][K]['model']>> }
            | {
                set: MaybeArray<WhereArg<T['relations'][K]['model']>>;
              }
            | { delete: MaybeArray<WhereArg<T['relations'][K]['model']>> }
            | {
                update: {
                  where: MaybeArray<WhereArg<T['relations'][K]['model']>>;
                  data: UpdateData<T['relations'][K]['model']>;
                };
              }
        : never;
    }
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {});

type UpdateArgs<T extends Query, ForceAll extends boolean> = (
  T['hasWhere'] extends true ? true : ForceAll
) extends true
  ? [update: RawExpression | UpdateData<T>, forceAll?: ForceAll]
  : [update: RawExpression | UpdateData<T>, forceAll: true];

type UpdateResult<T extends Query> = T['hasSelect'] extends false
  ? SetQueryReturnsRowCount<T>
  : T;

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

  pushQueryValue(self, 'data', map);
  return self as unknown as UpdateResult<T>;
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
    const [data, forceAll] = args as unknown as [
      Record<string, unknown>,
      boolean | undefined,
    ];
    const { query } = this;
    query.type = 'update';

    if (!query.and?.length && !query.or?.length && !forceAll) {
      throw new Error(
        'No where conditions or forceAll flag provided to update',
      );
    }

    if (isRaw(data)) {
      pushQueryValue(this, 'data', data);
    } else {
      const relations = this.relations as Record<string, Relation>;

      const prependRelations: Record<string, Record<string, unknown>> = {};
      const appendRelations: Record<string, Record<string, unknown>> = {};

      const update: Record<string, unknown> = { ...data };
      for (const key in data) {
        if (relations[key]) {
          delete update[key];
          if (relations[key].type === 'belongsTo') {
            prependRelations[key] = data[key] as Record<string, unknown>;
          } else {
            if (!query.select?.includes('*')) {
              const primaryKey = relations[key].primaryKey;
              if (!query.select?.includes(primaryKey)) {
                this._select(primaryKey);
              }
            }
            appendRelations[key] = data[key] as Record<string, unknown>;
          }
        }
      }

      const prependRelationKeys = Object.keys(prependRelations);
      if (prependRelationKeys.length) {
        const state: {
          updateLater?: Record<string, unknown>;
          updateLaterPromises?: Promise<void>[];
        } = {};

        const willSetKeys = prependRelationKeys.some((relationName) => {
          const data = prependRelations[relationName] as NestedUpdateOneItem;

          return (
            relations[relationName] as {
              nestedUpdate: BelongsToNestedUpdate;
            }
          ).nestedUpdate(this, update, data, state);
        });

        if (state.updateLater) {
          const { updateLater } = state;

          this.schema.primaryKeys.forEach((key: string) => {
            if (!query.select?.includes('*') && !query.select?.includes(key)) {
              this._select(key);
            }
          });

          const { handleResult } = this.query;
          this.query.handleResult = async (q, queryResult) => {
            const result = await handleResult(q, queryResult);

            await Promise.all(state.updateLaterPromises as Promise<void>[]);

            const t = (this.__model || this).clone().transacting(q);
            const keys = this.schema.primaryKeys as string[];
            if (Array.isArray(result)) {
              (
                t._whereIn as unknown as (
                  keys: string[],
                  values: unknown[][],
                ) => Query
              )(
                keys,
                result.map((item) => keys.map((key) => item[key])),
              );
            } else {
              const conditions: Record<string, unknown> = {};
              keys.forEach(
                (key) =>
                  (conditions[key] = (result as Record<string, unknown>)[key]),
              );
              t._where(conditions as WhereArg<Query>);
            }

            await (t as WhereResult<Query>)._update(updateLater);

            return Array.isArray(result)
              ? result.map((item) => Object.assign(item, updateLater))
              : Object.assign(result as object, updateLater);
          };
        }

        if (!willSetKeys && !Object.keys(update).length) {
          delete this.query.type;
        }
      } else if (!Object.keys(update).length) {
        delete this.query.type;
      }

      const appendRelationKeys = Object.keys(appendRelations);
      if (appendRelationKeys.length) {
        pushQueryArray(
          this,
          'afterQuery',
          appendRelationKeys.map((relationName) => {
            return async (q: Query, result: unknown) => {
              const all = (
                q.returnType === 'all' ? result : [result]
              ) as Record<string, unknown>[];

              await (
                relations[relationName].nestedUpdate as HasOneNestedUpdate
              )?.(q, all, appendRelations[relationName] as NestedUpdateOneItem);
            };
          }),
        );
      }

      if (prependRelationKeys.length || appendRelationKeys.length) {
        query.wrapInTransaction = true;
      }

      pushQueryValue(this, 'data', update);
    }

    if (!query.select) {
      this.returnType = 'rowCount';
    }

    return this as unknown as UpdateResult<T>;
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
