import {
  CreateCtx,
  Query,
  RelationConfigBase,
  UpdateData,
  WhereArg,
  WhereQueryBase,
} from 'pqb';
import { MaybeArray } from 'orchid-core';
import { HasOneNestedInsert, HasOneNestedUpdate } from './hasOne';
import { HasManyNestedInsert, HasManyNestedUpdate } from './hasMany';

export type NestedInsertOneItem = {
  create?: Record<string, unknown>;
  connect?: WhereArg<WhereQueryBase>;
  connectOrCreate?: {
    where: WhereArg<WhereQueryBase>;
    create: Record<string, unknown>;
  };
};

export type NestedInsertManyItems = {
  create?: Record<string, unknown>[];
  connect?: WhereArg<WhereQueryBase>[];
  connectOrCreate?: {
    where: WhereArg<WhereQueryBase>;
    create: Record<string, unknown>;
  }[];
};

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
  primaryKey: string,
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

  q._afterCreate([primaryKey], (rows, q) =>
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
  primaryKey: string,
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

  if (!q.q.select?.includes('*') && !q.q.select?.includes(primaryKey)) {
    q._select(primaryKey);
  }

  q.q.wrapInTransaction = true;

  q._afterUpdate(q.primaryKeys, (rows, q) => {
    return (nestedUpdate as HasOneNestedUpdate)(
      q,
      rows,
      value as NestedUpdateOneItem,
    );
  });
};
