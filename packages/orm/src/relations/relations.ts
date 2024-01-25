import { BelongsTo, BelongsToInfo, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneInfo, makeHasOneMethod } from './hasOne';
import { DbTable, Table, TableClass } from '../baseTable';
import { OrchidORM } from '../orm';
import {
  CreateData,
  getQueryAs,
  Query,
  RelationConfigBase,
  RelationJoinQuery,
  RelationQuery,
  RelationsBase,
  VirtualColumn,
  WhereArg,
} from 'pqb';
import { ColumnSchemaConfig, EmptyObject, StringKey } from 'orchid-core';
import { HasMany, HasManyInfo, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyInfo,
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

export type RelationThunks = Record<string, RelationThunk>;

export type RelationData = {
  returns: 'one' | 'many';
  method(params: Record<string, unknown>): Query;
  virtualColumn?: VirtualColumn<ColumnSchemaConfig>;
  joinQuery: RelationJoinQuery;
  reverseJoin: RelationJoinQuery;
  modifyRelatedQuery?(relatedQuery: Query): (query: Query) => void;
};

export type RelationScopeOrTable<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : RelationQueryFromFn<Relation>;

type RelationQueryFromFn<
  Relation extends RelationThunkBase,
  TC extends TableClass = ReturnType<Relation['fn']>,
  Q extends Query = DbTable<TC>,
> = Q;

export type RelationConfig<
  T extends Table = Table,
  Relations extends RelationThunks = RelationThunks,
  Relation extends RelationThunk = RelationThunk,
  K extends PropertyKey = PropertyKey,
  Result extends RelationConfigBase = Relation extends BelongsTo
    ? BelongsToInfo<T, Relation, StringKey<K>>
    : Relation extends HasOne
    ? HasOneInfo<T, Relations, Relation, StringKey<K>>
    : Relation extends HasMany
    ? HasManyInfo<T, Relations, Relation, StringKey<K>>
    : Relation extends HasAndBelongsToMany
    ? HasAndBelongsToManyInfo<T, Relation, StringKey<K>>
    : never,
> = Result;

export type MapRelation<
  T extends Table,
  Relations extends RelationThunks,
  RelationName extends keyof Relations,
  Relation extends RelationThunk = Relations[RelationName],
> = RelationQuery<
  RelationName,
  RelationConfig<T, Relations, Relation, RelationName>,
  RelationScopeOrTable<Relation>
>;

export type MapRelations<T extends Table> = T extends {
  relations: RelationThunks;
}
  ? {
      [K in keyof T['relations']]: MapRelation<T, T['relations'], K>;
    }
  : EmptyObject;

type ApplyRelationData = {
  relationName: string;
  relation: RelationThunk;
  dbTable: DbTable<TableClass>;
  otherDbTable: DbTable<TableClass>;
};

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
            throughRelation.table,
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
          ?.relationConfig;

        if (through && !throughRel) {
          message += `: cannot find \`${through}\` relation required by the \`through\` option`;
        } else if (
          source &&
          throughRel &&
          !throughRel.table.relations[source as never]
        ) {
          message += `: cannot find \`${source}\` relation in \`${
            (throughRel.table as DbTable<TableClass>).definedAs
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
      query._take();
    } else {
      query._takeOptional();
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

  (dbTable.relations as Record<string, unknown>)[relationName] = query;

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
      if (this.q.isSubQuery) {
        query = toTable;
        query.q.isSubQuery = true;
      } else {
        query = toTable
          // Relation query returns a single record in case of belongsTo or hasOne,
          // but when called as a query chain like `q.user.profile` it should return many.
          ._all()
          ._where({
            EXISTS: {
              args: [data.reverseJoin(this, toTable)],
            },
          });
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
          return (query as unknown as Record<string, unknown>)[prop as string];
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
