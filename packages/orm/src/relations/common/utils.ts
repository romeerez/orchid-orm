import {
  _queryHookAfterCreate,
  _queryHookAfterUpdate,
  Column,
  CreateCtx,
  getQueryAs,
  JoinQueryMethod,
  pushQueryOnForOuter,
  Query,
  setQueryObjectValueImmutable,
  UpdateData,
  WhereArg,
  emptyObject,
  MaybeArray,
  PickQueryRelations,
  RecordUnknown,
  RelationConfigBase,
  PickQuerySelectableRelations,
} from 'pqb';
import { HasOneNestedInsert, HasOneNestedUpdate } from '../hasOne';
import { HasManyNestedInsert, HasManyNestedUpdate } from '../hasMany';
import { BaseTableClass, ORMTableInput } from '../../baseTable';
import { RelationRefsOptions } from './options';

// INNER JOIN the current relation instead of the default OUTER behavior
export interface RelJoin extends JoinQueryMethod {
  <T extends Query>(this: T): T;
}

export interface HasRelJoin {
  join: RelJoin;
}

export interface NestedInsertOneItem {
  create?: NestedInsertOneItemCreate;
  connect?: NestedInsertOneItemConnect;
  connectOrCreate?: NestedInsertOneItemConnectOrCreate;
}

export type NestedInsertOneItemCreate = RecordUnknown;
export type NestedInsertOneItemConnect = RecordUnknown;

export interface NestedInsertOneItemConnectOrCreate {
  where: WhereArg<PickQuerySelectableRelations>;
  create: RecordUnknown;
}

export interface NestedInsertManyItems {
  create?: NestedInsertManyCreate;
  connect?: NestedInsertManyConnect;
  connectOrCreate?: NestedInsertManyConnectOrCreate;
}

export type NestedInsertManyCreate = RecordUnknown[];

export type NestedInsertManyConnect = WhereArg<PickQuerySelectableRelations>[];

export type NestedInsertManyConnectOrCreate =
  NestedInsertOneItemConnectOrCreate[];

export type NestedInsertItem = NestedInsertOneItem | NestedInsertManyItems;

export interface NestedUpdateOneItem {
  add?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
  disconnect?: boolean;
  set?: WhereArg<PickQuerySelectableRelations>;
  delete?: boolean;
  update?: UpdateData<Query>;
  upsert?: {
    update: UpdateData<Query>;
    create: RecordUnknown | (() => RecordUnknown);
  };
  create: RecordUnknown;
}

export interface NestedUpdateManyItems {
  add?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
  disconnect?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
  set?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
  delete?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
  update?: {
    where: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
    data: UpdateData<Query>;
  };
  create: RecordUnknown[];
}

export type NestedUpdateItem = NestedUpdateOneItem | NestedUpdateManyItems;

export const getThroughRelation = (
  table: Query,
  through: string,
): RelationConfigBase => {
  return table.relations[through];
};

export const getSourceRelation = (
  throughRelation: RelationConfigBase,
  source: string,
): RelationConfigBase => {
  return (throughRelation.query as unknown as PickQueryRelations).relations[
    source
  ];
};

export const hasRelationHandleCreate = (
  q: Query,
  ctx: CreateCtx,
  item: RecordUnknown,
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

  _queryHookAfterCreate(q, primaryKeys, (rows, q) =>
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
  set: RecordUnknown,
  key: string,
  primaryKeys: string[],
  nestedUpdate: HasOneNestedUpdate | HasManyNestedUpdate,
) => {
  const value = set[key] as NestedUpdateItem;

  if (
    !value.set &&
    !('upsert' in value) &&
    (!value.add || (Array.isArray(value.add) && value.add.length === 0)) &&
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

  q.q.wrapInTransaction = true;

  _queryHookAfterUpdate(q, primaryKeys, (rows, q) => {
    return (nestedUpdate as HasOneNestedUpdate)(
      q,
      rows,
      value as NestedUpdateOneItem,
    );
  });
};

export const _selectIfNotSelected = (q: Query, columns: string[]) => {
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

export function joinHasThrough(
  q: Query,
  baseQuery: Query,
  joiningQuery: Query,
  throughRelation: RelationConfigBase,
  sourceRelation: RelationConfigBase,
): Query {
  return q.whereExists(
    throughRelation.joinQuery(
      throughRelation.query as never,
      baseQuery as never,
    ) as never,
    (() => {
      const as = getQueryAs(joiningQuery);
      return sourceRelation.joinQuery(
        (sourceRelation.query as Query).as(as),
        throughRelation.query as never,
      );
    }) as never,
  );
}

export function joinHasRelation(
  baseQuery: Query,
  joiningQuery: Query,
  primaryKeys: string[],
  foreignKeys: string[],
  len: number,
) {
  const baseAs = getQueryAs(baseQuery);

  const q = joiningQuery.clone();
  setQueryObjectValueImmutable(q, 'joinedShapes', baseAs, baseQuery.q.shape);

  for (let i = 0; i < len; i++) {
    pushQueryOnForOuter(
      q,
      baseQuery,
      joiningQuery,
      foreignKeys[i],
      `${baseAs}.${primaryKeys[i]}`,
    );
  }

  return q;
}

export const addAutoForeignKey = (
  tableConfig: ORMTableInput,
  from: Query,
  to: Query,
  primaryKeys: string[],
  foreignKeys: string[],
  options: RelationRefsOptions<PropertyKey>,
  // non-snake-cased
  originalForeignKeys?: string[],
) => {
  const toTable = to.table as string;

  let fkeyOptions =
    options.foreignKey !== undefined
      ? options.foreignKey
      : tableConfig.autoForeignKeys;
  if (!fkeyOptions) return;

  if (fkeyOptions === true) {
    fkeyOptions = tableConfig.autoForeignKeys || emptyObject;
  }

  if (foreignKeys.length === 1) {
    const column = from.shape[foreignKeys[0]] as Column;
    if (column.data.foreignKeys) {
      const pkey = primaryKeys[0];

      for (const fkey of column.data.foreignKeys) {
        let fkeyTable: string;
        let fkeyColumn = fkey.foreignColumns[0];
        if (typeof fkey.fnOrTable === 'string') {
          fkeyTable = fkey.fnOrTable;
          fkeyColumn = getColumnKeyFromDbName(to, fkeyColumn);
        } else {
          fkeyTable = (fkey.fnOrTable() as unknown as BaseTableClass<any, any>) // eslint-disable-line @typescript-eslint/no-explicit-any
            .instance().table;
        }

        if (toTable === fkeyTable && pkey === fkeyColumn) return;
      }
    }
  }

  const { constraints } = from.internal.tableData;
  if (constraints) {
    const sortedPkeys = [...primaryKeys].sort();
    const sortedFkeys = [...foreignKeys].sort();

    for (const { references: refs } of constraints) {
      if (!refs) continue;

      if (
        refs.columns.length === sortedFkeys.length &&
        refs.columns.every((column, i) => column === sortedFkeys[i]) &&
        refs.foreignColumns.length === sortedPkeys.length &&
        (typeof refs.fnOrTable === 'string'
          ? refs.fnOrTable === toTable &&
            refs.foreignColumns.every(
              (column, i) =>
                getColumnKeyFromDbName(to, column) === sortedPkeys[i],
            )
          : (refs.fnOrTable as unknown as () => BaseTableClass<any, any>)() // eslint-disable-line @typescript-eslint/no-explicit-any
              .instance().table === toTable &&
            refs.foreignColumns.every((column, i) => column === sortedPkeys[i]))
      )
        return;
    }
  }

  (from.internal.tableData.constraints ??= []).push({
    references: {
      columns: originalForeignKeys || foreignKeys,
      fnOrTable: toTable,
      foreignColumns: primaryKeys,
      options: fkeyOptions,
    },
    dropMode: fkeyOptions.dropMode,
  });
};

const getColumnKeyFromDbName = (query: Query, name: string) => {
  for (const k in query.shape) {
    if ((query.shape[k] as Column).data.name === name) {
      return k;
    }
  }
  return name;
};
