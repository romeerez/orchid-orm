import {
  CreateCtx,
  getQueryAs,
  JoinCallback,
  pushQueryOn,
  Query,
  RelationConfigBase,
  setQueryObjectValue,
  UpdateData,
  WhereArg,
  WhereQueryBase,
} from 'pqb';
import { MaybeArray } from 'orchid-core';
import { HasOneNestedInsert, HasOneNestedUpdate } from '../hasOne';
import { HasManyNestedInsert, HasManyNestedUpdate } from '../hasMany';

export type NestedInsertOneItem = {
  create?: NestedInsertOneItemCreate;
  connect?: NestedInsertOneItemConnect;
  connectOrCreate?: NestedInsertOneItemConnectOrCreate;
};

export type NestedInsertOneItemCreate = Record<string, unknown>;

export type NestedInsertOneItemConnect = WhereArg<WhereQueryBase>;

export type NestedInsertOneItemConnectOrCreate = {
  where: WhereArg<WhereQueryBase>;
  create: Record<string, unknown>;
};

export type NestedInsertManyItems = {
  create?: NestedInsertManyCreate;
  connect?: NestedInsertManyConnect;
  connectOrCreate?: NestedInsertManyConnectOrCreate;
};

export type NestedInsertManyCreate = Record<string, unknown>[];

export type NestedInsertManyConnect = WhereArg<WhereQueryBase>[];

export type NestedInsertManyConnectOrCreate = {
  where: WhereArg<WhereQueryBase>;
  create: Record<string, unknown>;
}[];

export type NestedInsertItem = NestedInsertOneItem | NestedInsertManyItems;

export type NestedUpdateOneItem = {
  disconnect?: boolean;
  set?: WhereArg<WhereQueryBase>;
  delete?: boolean;
  update?: UpdateData<Query>;
  upsert?: {
    update: UpdateData<Query>;
    create: Record<string, unknown> | (() => Record<string, unknown>);
  };
  create: Record<string, unknown>;
};

export type NestedUpdateManyItems = {
  disconnect?: MaybeArray<WhereArg<WhereQueryBase>>;
  set?: MaybeArray<WhereArg<WhereQueryBase>>;
  delete?: MaybeArray<WhereArg<WhereQueryBase>>;
  update?: {
    where: MaybeArray<WhereArg<WhereQueryBase>>;
    data: UpdateData<Query>;
  };
  create: Record<string, unknown>[];
};

export type NestedUpdateItem = NestedUpdateOneItem | NestedUpdateManyItems;

export const getThroughRelation = (
  table: Query,
  through: string,
): RelationConfigBase => {
  return table.relations[through]?.relationConfig;
};

export const getSourceRelation = (
  throughRelation: RelationConfigBase,
  source: string,
): RelationConfigBase => {
  return throughRelation.table.relations[source]?.relationConfig;
};

export const hasRelationHandleCreate = (
  q: Query,
  ctx: CreateCtx,
  item: Record<string, unknown>,
  rowIndex: number,
  key: string,
  primaryKeys: string[],
  nestedInsert: HasOneNestedInsert | HasManyNestedInsert,
) => {
  const value = item[key] as NestedInsertItem;
  if (
    (!value.create ||
      (Array.isArray(value.create) && value.create.length === 0)) &&
    (!value.connect ||
      (Array.isArray(value.connect) && value.connect.length === 0)) &&
    (!value.connectOrCreate ||
      (Array.isArray(value.connectOrCreate) &&
        value.connectOrCreate.length === 0))
  )
    return;

  const store = ctx as unknown as {
    hasRelation?: Record<string, [number, NestedInsertItem][]>;
  };

  if (!store.hasRelation) store.hasRelation = {};

  const values = [rowIndex, value] as [number, NestedInsertItem];

  if (store.hasRelation[key]) {
    store.hasRelation[key].push(values);
    return;
  }

  q.q.wrapInTransaction = true;

  const relationData = [values];
  store.hasRelation[key] = relationData;

  q._afterCreate(primaryKeys, (rows, q) =>
    (nestedInsert as HasOneNestedInsert)(
      q,
      relationData.map(([rowIndex, data]) => [
        rows[rowIndex],
        data as NestedInsertOneItem,
      ]),
    ),
  );
};

export const hasRelationHandleUpdate = (
  q: Query,
  set: Record<string, unknown>,
  key: string,
  primaryKeys: string[],
  nestedUpdate: HasOneNestedUpdate | HasManyNestedUpdate,
) => {
  const value = set[key] as NestedUpdateItem;

  if (
    !value.set &&
    !('upsert' in value) &&
    (!value.disconnect ||
      (Array.isArray(value.disconnect) && value.disconnect.length === 0)) &&
    (!value.delete ||
      (Array.isArray(value.delete) && value.delete.length === 0)) &&
    (!value.update ||
      (Array.isArray(value.update.where) && value.update.where.length === 0)) &&
    (!value.create ||
      (Array.isArray(value.create) && value.create.length === 0))
  )
    return;

  selectIfNotSelected(q, primaryKeys);

  q.q.wrapInTransaction = true;

  q._afterUpdate(q.primaryKeys, (rows, q) => {
    return (nestedUpdate as HasOneNestedUpdate)(
      q,
      rows,
      value as NestedUpdateOneItem,
    );
  });
};

export const selectIfNotSelected = (q: Query, columns: string[]) => {
  const select = q.q.select || [];
  if (!select.includes('*')) {
    for (const column of columns) {
      if (!select.includes(column)) {
        select.push(column);
      }
    }
    q.q.select = select;
  }
};

export const relationWhere =
  (len: number, keys: string[], valueKeys: string[]) =>
  (params: Record<string, unknown>) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < len; i++) {
      obj[keys[i]] = params[valueKeys[i]];
    }
    return obj;
  };

export function joinHasThrough(
  q: Query,
  fromQuery: Query,
  toQuery: Query,
  throughRelation: RelationConfigBase,
  sourceRelation: RelationConfigBase,
): Query {
  return q.whereExists<Query, Query>(
    throughRelation.joinQuery(fromQuery, throughRelation.query),
    (() => {
      const as = getQueryAs(toQuery);
      return sourceRelation.joinQuery(
        throughRelation.query,
        sourceRelation.query.as(as),
      );
    }) as unknown as JoinCallback<Query, Query>,
  );
}

export function joinHasRelation(
  fromQuery: Query,
  toQuery: Query,
  primaryKeys: string[],
  foreignKeys: string[],
  len: number,
) {
  const q = toQuery.clone();

  setQueryObjectValue(
    q,
    'joinedShapes',
    (fromQuery.q.as || fromQuery.table) as string,
    fromQuery.q.shape,
  );

  for (let i = 0; i < len; i++) {
    pushQueryOn(q, fromQuery, toQuery, foreignKeys[i], primaryKeys[i]);
  }

  return q;
}
