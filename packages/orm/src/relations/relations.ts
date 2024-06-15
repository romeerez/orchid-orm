import {
  BelongsTo,
  BelongsToFKey,
  BelongsToInfo,
  BelongsToParams,
  makeBelongsToMethod,
} from './belongsTo';
import { HasOne, HasOneInfo, HasOneParams, makeHasOneMethod } from './hasOne';
import { DbTable, Table, TableClass } from '../baseTable';
import { OrchidORM } from '../orm';
import {
  _queryAll,
  _queryTake,
  _queryTakeOptional,
  _queryWhere,
  CreateData,
  getQueryAs,
  Query,
  RelationJoinQuery,
  RelationQuery,
  RelationsBase,
  VirtualColumn,
  WhereArg,
} from 'pqb';
import {
  ColumnSchemaConfig,
  ColumnsShapeBase,
  EmptyObject,
  RecordUnknown,
} from 'orchid-core';
import {
  HasMany,
  HasManyInfo,
  HasManyParams,
  makeHasManyMethod,
} from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyInfo,
  HasAndBelongsToManyParams,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';
import { getSourceRelation, getThroughRelation } from './common/utils';
import { RelationCommonOptions } from './common/options';

// `belongsTo` and `hasOne` relation data available for create. It supports:
// - `create` to create a related record
// - `connect` to find existing record and use its primary key
// - `connectOrCreate` to first try connecting to an existing record, and create it if not found
export type RelationToOneDataForCreate<
  Rel extends { nestedCreateQuery: Query; table: Query },
> =
  | {
      create: CreateData<Rel['nestedCreateQuery']>;
      connect?: never;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect: WhereArg<Rel['table']>;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect?: never;
      connectOrCreate: {
        where: WhereArg<Rel['table']>;
        create: CreateData<Rel['nestedCreateQuery']>;
      };
    };

export type RelationToOneDataForCreateSameQuery<Q extends Query> =
  | {
      create: CreateData<Q>;
      connect?: never;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect: WhereArg<Q>;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect?: never;
      connectOrCreate: {
        where: WhereArg<Q>;
        create: CreateData<Q>;
      };
    };

// `hasMany` and `hasAndBelongsToMany` relation data available for create. It supports:
// - `create` to create related records
// - `connect` to find existing records by `where` conditions and update their foreign keys with the new id
// - `connectOrCreate` to first try finding records by `where` conditions, and create them if not found
export type RelationToManyDataForCreate<
  Rel extends { nestedCreateQuery: Query; table: Query },
> = {
  create?: CreateData<Rel['nestedCreateQuery']>[];
  connect?: WhereArg<Rel['table']>[];
  connectOrCreate?: {
    where: WhereArg<Rel['table']>;
    create: CreateData<Rel['nestedCreateQuery']>;
  }[];
};

export interface RelationThunkBase {
  type: string;
  fn(): TableClass;
  options: RelationCommonOptions;
}

export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;

export interface RelationThunks {
  [K: string]: RelationThunk;
}

export interface RelationData {
  returns: 'one' | 'many';
  method(params: RecordUnknown): Query;
  virtualColumn?: VirtualColumn<ColumnSchemaConfig>;
  joinQuery: RelationJoinQuery;
  reverseJoin: RelationJoinQuery;
  modifyRelatedQuery?(relatedQuery: Query): (query: Query) => void;
}

export type RelationScopeOrTable<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : DbTable<InstanceType<ReturnType<Relation['fn']>>>;

export interface RelationConfigSelf {
  columns: { shape: ColumnsShapeBase };
  relations: RelationThunks;
}

export type RelationConfigParams<
  T extends RelationConfigSelf,
  Relation extends RelationThunk,
> = Relation extends BelongsTo
  ? BelongsToParams<T, Relation>
  : Relation extends HasOne
  ? HasOneParams<T, Relation>
  : Relation extends HasMany
  ? HasManyParams<T, Relation>
  : Relation extends HasAndBelongsToMany
  ? HasAndBelongsToManyParams<T, Relation>
  : never;

export type MapRelation<
  T extends RelationConfigSelf,
  K extends keyof T['relations'] & string,
> = RelationQuery<
  T['relations'][K] extends BelongsTo
    ? BelongsToInfo<
        T,
        K,
        RelationScopeOrTable<T['relations'][K]>,
        BelongsToFKey<T['relations'][K]>,
        T['relations'][K]['options']['required']
      >
    : T['relations'][K] extends HasOne
    ? HasOneInfo<T, K, RelationScopeOrTable<T['relations'][K]>>
    : T['relations'][K] extends HasMany
    ? HasManyInfo<T, K, RelationScopeOrTable<T['relations'][K]>>
    : T['relations'][K] extends HasAndBelongsToMany
    ? HasAndBelongsToManyInfo<T, K, RelationScopeOrTable<T['relations'][K]>>
    : never
>;

export type MapRelations<T> = T extends RelationConfigSelf
  ? {
      [K in keyof T['relations'] & string]: MapRelation<T, K>;
    }
  : EmptyObject;

interface ApplyRelationData {
  relationName: string;
  relation: RelationThunk;
  dbTable: DbTable<Table>;
  otherDbTable: DbTable<Table>;
}

type DelayedRelations = Map<Query, Record<string, ApplyRelationData[]>>;

export const applyRelations = (
  qb: Query,
  tables: Record<string, Table>,
  result: OrchidORM,
) => {
  const tableEntries = Object.entries(tables);

  const delayedRelations: DelayedRelations = new Map();

  for (const name in tables) {
    const table = tables[name] as Table & {
      relations?: RelationThunks;
    };
    if (!('relations' in table) || typeof table.relations !== 'object')
      continue;

    const dbTable = result[name];
    for (const relationName in table.relations) {
      const relation = table.relations[relationName];
      const otherTableClass = relation.fn();
      const otherTable = tableEntries.find(
        (pair) => pair[1] instanceof otherTableClass,
      );
      if (!otherTable) {
        throw new Error(
          `Cannot find table class for class ${otherTableClass.name}`,
        );
      }
      const otherTableName = otherTable[0];
      const otherDbTable = result[otherTableName];
      if (!otherDbTable)
        throw new Error(`Cannot find table class by name ${otherTableName}`);

      const data: ApplyRelationData = {
        relationName,
        relation,
        dbTable,
        otherDbTable,
      };

      const options = relation.options as { through?: string; source?: string };
      if (
        typeof options.through === 'string' &&
        typeof options.source === 'string'
      ) {
        const throughRelation = getThroughRelation(dbTable, options.through);
        if (!throughRelation) {
          delayRelation(delayedRelations, dbTable, options.through, data);
          continue;
        }

        const sourceRelation = getSourceRelation(
          throughRelation,
          options.source,
        );
        if (!sourceRelation) {
          delayRelation(
            delayedRelations,
            (throughRelation as unknown as { table: Query }).table,
            options.source,
            data,
          );
          continue;
        }
      }

      applyRelation(qb, data, delayedRelations);
    }
  }

  if (delayedRelations.size) {
    const { value } = delayedRelations.values().next() as {
      value: Record<string, ApplyRelationData[]>;
    };
    for (const key in value) {
      for (const item of value[key]) {
        const { relation } = item;

        if (item.dbTable.relations[item.relationName as never]) continue;

        const as = item.dbTable.definedAs;
        let message = `Cannot define a \`${item.relationName}\` relation on \`${as}\``;
        const table = result[as];

        const { through, source } = relation.options as {
          through: string;
          source: string;
        };
        const throughRel = (table.relations as RelationsBase)[through]
          ?.relationConfig as unknown as { table: Query } | undefined;

        if (through && !throughRel) {
          message += `: cannot find \`${through}\` relation required by the \`through\` option`;
        } else if (
          source &&
          throughRel &&
          !throughRel.table.relations[source as never]
        ) {
          message += `: cannot find \`${source}\` relation in \`${
            (throughRel.table as DbTable<Table>).definedAs
          }\` required by the \`source\` option`;
        }

        throw new Error(message);
      }
    }
  }
};

const delayRelation = (
  delayedRelations: DelayedRelations,
  table: Query,
  relationName: string,
  data: ApplyRelationData,
) => {
  let tableRelations = delayedRelations.get(table);
  if (!tableRelations) {
    tableRelations = {};
    delayedRelations.set(table, tableRelations);
  }
  if (tableRelations[relationName]) {
    tableRelations[relationName].push(data);
  } else {
    tableRelations[relationName] = [data];
  }
};

const applyRelation = (
  qb: Query,
  { relationName, relation, dbTable, otherDbTable }: ApplyRelationData,
  delayedRelations: DelayedRelations,
) => {
  const baseQuery = Object.create(otherDbTable);
  baseQuery.baseQuery = baseQuery;

  const query = (
    relation.options.scope ? relation.options.scope(baseQuery) : baseQuery
  ).as(relationName);

  const definedAs = (query as unknown as { definedAs?: string }).definedAs;
  if (!definedAs) {
    throw new Error(
      `Table class for table ${query.table} is not attached to db instance`,
    );
  }

  const { type } = relation;
  let data;
  if (type === 'belongsTo') {
    data = makeBelongsToMethod(relation, relationName, query);
  } else if (type === 'hasOne') {
    data = makeHasOneMethod(dbTable, relation, relationName, query);
  } else if (type === 'hasMany') {
    data = makeHasManyMethod(dbTable, relation, relationName, query);
  } else if (type === 'hasAndBelongsToMany') {
    data = makeHasAndBelongsToManyMethod(
      dbTable,
      qb,
      relation,
      relationName,
      query,
    );
  } else {
    throw new Error(`Unknown relation type ${type}`);
  }

  if (data.returns === 'one') {
    if (relation.options.required) {
      _queryTake(query);
    } else {
      _queryTakeOptional(query);
    }

    query.q.returnsOne = true;
  }

  if (data.virtualColumn) {
    dbTable.shape[relationName] = dbTable.q.shape[relationName] =
      data.virtualColumn;
  }

  makeRelationQuery(dbTable, relationName, data, query);

  baseQuery.joinQuery = data.joinQuery;

  const { join: originalJoin } = baseQuery;
  baseQuery.join = function (...args: unknown[]) {
    if (args.length) {
      return originalJoin.apply(this, args);
    } else {
      const q = this.clone();
      q.q.innerJoinLateral = true;
      return q;
    }
  };

  baseQuery.relationConfig = {
    table: otherDbTable,
    query,
    joinQuery: data.joinQuery,
  };

  (dbTable.relations as RecordUnknown)[relationName] = query;

  const tableRelations = delayedRelations.get(dbTable);
  if (!tableRelations) return;

  tableRelations[relationName]?.forEach((data) => {
    applyRelation(qb, data, delayedRelations);
  });
};

const makeRelationQuery = (
  table: Query,
  relationName: string,
  data: RelationData,
  q: Query,
) => {
  Object.defineProperty(table, relationName, {
    configurable: true,
    get() {
      const toTable = q.clone();

      let query: Query;
      if (this.q.subQuery) {
        query = toTable;
        query.q.subQuery = 2;
      } else {
        // Relation query returns a single record in case of belongsTo or hasOne,
        // but when called as a query chain like `q.user.profile` it should return many.
        query = _queryWhere(_queryAll(toTable), [
          {
            EXISTS: { q: data.reverseJoin(this, toTable) },
          },
        ]);
      }

      if (this.q.relChain) {
        query.q.relChain = [...this.q.relChain, this];
        query.q.returnType = 'all';
      } else {
        query.q.relChain = [this];
      }

      query.q.joinedShapes = {
        [getQueryAs(this)]: this.q.shape,
        ...this.q.joinedShapes,
      };

      const setQuery = data.modifyRelatedQuery?.(query);
      setQuery?.(this);

      return new Proxy(data.method, {
        get(_, prop) {
          return (query as unknown as RecordUnknown)[prop as string];
        },
      }) as unknown as RelationQuery;
    },
    set(value) {
      Object.defineProperty(this, relationName, {
        value,
      });
    },
  });
};
