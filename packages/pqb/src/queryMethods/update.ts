import {
  Query,
  QueryBase,
  SetQueryReturnsAll,
  SetQueryReturnsRowCount,
} from '../query';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression } from '../common';
import {
  BelongsToNestedUpdate,
  BelongsToRelation,
  HasOneNestedUpdate,
  Relation,
} from '../relations';
import { SelectArg } from './select';
import { WhereArg } from './where';

type UpdateData<T extends Query> = {
  [K in keyof T['type']]?: T['type'][K] | RawExpression;
} & (T['relations'] extends Record<string, Relation>
  ? {
      [K in keyof T['relations']]?: T['relations'][K]['returns'] extends 'one'
        ? { disconnect?: boolean }
        : T['relations'][K]['returns'] extends 'many'
        ? { disconnect?: WhereArg<T['relations'][K]['model']>[] }
        : never;
    }
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {});

type UpdateResult<T extends Query> = T['hasSelect'] extends false
  ? SetQueryReturnsRowCount<T>
  : SetQueryReturnsAll<T>;

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
  update<T extends Query>(
    this: T,
    data: RawExpression | UpdateData<T>,
  ): UpdateResult<T> {
    const q = this.clone() as T;
    return q._update(data);
  }

  _update<T extends Query>(
    this: T,
    data: RawExpression | UpdateData<T>,
  ): UpdateResult<T> {
    let returning = this.query.select;
    this.query.type = 'update';
    this.returnType = returning ? 'all' : 'rowCount';

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
            if (!returning?.includes('*')) {
              const primaryKey = relations[key].primaryKey;
              if (!returning) {
                returning = [primaryKey];
              } else if (!returning.includes(primaryKey)) {
                returning.push(primaryKey);
              }
            }
            appendRelations[key] = data[key] as Record<string, unknown>;
          }
        }
      }
      const prependRelationKeys = Object.keys(prependRelations);
      if (prependRelationKeys.length) {
        pushQueryArray(
          this,
          'beforeQuery',
          prependRelationKeys.map((relationName) => {
            return async (q: Query) => {
              const relationData = prependRelations[relationName];
              const relation = relations[relationName];

              const updated = await (
                relation.nestedUpdate as BelongsToNestedUpdate
              )(q, relationData);

              const { options } = relation as BelongsToRelation;

              update[options.foreignKey] = updated[options.primaryKey];
            };
          }),
        );
      } else if (!Object.keys(update).length) {
        delete this.query.type;
        this.returnType = 'all';
        if (returning) this._select(...(returning as SelectArg<QueryBase>[]));
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
              )?.(q, all, appendRelations[relationName]);
            };
          }),
        );
      }

      pushQueryValue(this, 'data', update);
    }

    if (returning) {
      this.query.select = returning;
    }

    return this as unknown as UpdateResult<T>;
  }

  updateOrThrow<T extends Query>(
    this: T,
    data: RawExpression | UpdateData<T>,
  ): UpdateResult<T> {
    const q = this.clone() as T;
    return q._updateOrThrow(data);
  }

  _updateOrThrow<T extends Query>(
    this: T,
    data: RawExpression | UpdateData<T>,
  ): UpdateResult<T> {
    this.query.throwOnNotFound = true;
    return this._update(data) as unknown as UpdateResult<T>;
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
