import { OrchidOrmInternalError, Query } from 'pqb';
import {
  MaybeArray,
  objectHasValues,
  PickQuerySelectableRelations,
  RecordUnknown,
  toArray,
  WhereArg,
  _appendQuery,
  _queryDelete,
  _queryUpdate,
  _queryUpsert,
  UpdateSelf,
} from 'pqb/internal';
import {
  hasRelationHandleUpdate,
  makeNestedUpdateRelationIds,
  makeNestedUpdateUpsertData,
  NestedUpdateManyItems,
  throwIfQueryReturnsAllForNestedUpdate,
} from '../common/utils';

export type HasManyNestedUpdate = (
  query: Query,
  data: RecordUnknown[],
  relationData: NestedUpdateManyItems,
) => Promise<void>;

interface State {
  query: Query.NotReadOnlyQuery;
  primaryKeys: string[];
  foreignKeys: string[];
  on?: RecordUnknown;
}

const getWhereForNestedUpdate = (
  t: Query,
  data: RecordUnknown[],
  params: MaybeArray<WhereArg<PickQuerySelectableRelations>> | undefined,
  primaryKeys: string[],
  foreignKeys: string[],
): Query => {
  return t.where({
    IN: {
      columns: foreignKeys,
      values: data.map((item) => primaryKeys.map((key) => item[key])),
    },
    OR: params ? toArray(params) : undefined,
  });
};

export const nestedUpdate = ({
  query: relQuery,
  primaryKeys,
  foreignKeys,
}: State) => {
  const len = primaryKeys.length;

  return (async (_, data, params) => {
    const t = relQuery.clone();

    if (params.create) {
      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = data[0][primaryKeys[i]];
      }

      await (t as Query.NotReadOnlyQuery).insertMany(
        params.create.map((create) => ({
          ...create,
          ...obj,
        })),
      );
    }

    if (params.add) {
      if (data.length > 1) {
        throw new OrchidOrmInternalError(
          relQuery,
          '`connect` is not available when updating multiple records, it is only applicable for a single record update',
        );
      }

      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = data[0][primaryKeys[i]];
      }

      const relatedWheres = toArray(params.add);

      const count = (await _queryUpdate(
        t.where({ OR: relatedWheres }) as unknown as UpdateSelf,
        obj as never,
      )) as unknown as number;

      if (count < relatedWheres.length) {
        throw new OrchidOrmInternalError(
          relQuery,
          `Expected to find at least ${relatedWheres.length} record(s) based on \`add\` conditions, but found ${count}`,
        );
      }
    }

    if (params.disconnect || params.set) {
      const obj: RecordUnknown = {};
      for (const foreignKey of foreignKeys) {
        obj[foreignKey] = null;
      }

      const setConditions =
        params.set &&
        (Array.isArray(params.set)
          ? params.set.length
          : objectHasValues(params.set)) &&
        (Array.isArray(params.set)
          ? {
              OR: params.set,
            }
          : params.set);

      let queryToDisconnect = getWhereForNestedUpdate(
        t,
        data,
        params.disconnect,
        primaryKeys,
        foreignKeys,
      );

      // do not nullify those records that are going to be set, because the column may non-nullable.
      if (setConditions) {
        queryToDisconnect = queryToDisconnect.whereNot(setConditions) as never;
      }

      await _queryUpdate(
        queryToDisconnect as unknown as UpdateSelf,
        obj as never,
      );

      if (setConditions) {
        const obj: RecordUnknown = {};
        for (let i = 0; i < len; i++) {
          obj[foreignKeys[i]] = data[0][primaryKeys[i]];
        }

        await _queryUpdate(
          t.where<Query>(setConditions as never) as unknown as UpdateSelf,
          obj as never,
        );
      }
    }

    if (params.delete || params.update) {
      const q = getWhereForNestedUpdate(
        t,
        data,
        params.delete || params.update?.where,
        primaryKeys,
        foreignKeys,
      );

      if (params.delete) {
        await _queryDelete(q);
      } else if (params.update) {
        await _queryUpdate(
          q as unknown as UpdateSelf,
          params.update.data as never,
        );
      }
    }
  }) as HasManyNestedUpdate;
};

export const hasManyUpdate = (
  key: string,
  state: State,
  nestedUpdateFn: HasManyNestedUpdate,
  self: UpdateSelf,
  set: RecordUnknown,
) => {
  const querySelf = self as unknown as Query;
  const params = set[key] as NestedUpdateManyItems;
  throwIfQueryReturnsAllForNestedUpdate(querySelf, params);

  hasRelationHandleUpdate(
    querySelf,
    set,
    key,
    state.primaryKeys,
    nestedUpdateFn,
  );

  if (params.upsert) {
    const { primaryKeys, foreignKeys, query: relQuery } = state;

    const ids = makeNestedUpdateRelationIds(
      querySelf,
      relQuery,
      primaryKeys,
      foreignKeys,
    );

    const appendedQuery = _queryUpsert(
      ids.existingRelQuery,
      makeNestedUpdateUpsertData(params.upsert, ids.setIds),
    ) as unknown as Query;

    appendedQuery.q.returnType = 'void';

    _appendQuery(querySelf, appendedQuery, ids.setAppendedAs);
  }
};
