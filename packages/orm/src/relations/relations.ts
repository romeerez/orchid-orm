import { BelongsTo, BelongsToInfo, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneInfo, makeHasOneMethod } from './hasOne';
import { DbTable, Table, TableClass, TableClasses } from '../table';
import { OrchidORM } from '../orm';
import {
  Query,
  QueryWithTable,
  RelationQuery,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  BaseRelation,
  defaultsKey,
  relationQueryKey,
  EmptyObject,
  VirtualColumn,
} from 'pqb';
import { HasMany, HasManyInfo, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyInfo,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';
import { getSourceRelation, getThroughRelation } from './utils';

export interface RelationThunkBase {
  type: string;
  returns: 'one' | 'many';
  fn(): TableClass;
  options: BaseRelation['options'];
}

export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;

export type RelationThunks = Record<string, RelationThunk>;

export type RelationData = {
  returns: 'one' | 'many';
  method(params: Record<string, unknown>): Query;
  virtualColumn?: VirtualColumn;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  reverseJoin(fromQuery: Query, toQuery: Query): Query;
  primaryKey: string;
  modifyRelatedQuery?(relatedQuery: Query): (query: Query) => void;
};

export type Relation<
  T extends Table,
  Relations extends RelationThunks,
  K extends keyof Relations,
  M extends Query = DbTable<ReturnType<Relations[K]['fn']>>,
  Info extends RelationInfo = RelationInfo<T, Relations, Relations[K]>,
> = {
  type: Relations[K]['type'];
  returns: Relations[K]['returns'];
  key: K;
  table: M;
  query: M;
  joinQuery(fromQuery: Query, toQuery: Query): Query;
  defaults: Info['populate'];
  nestedCreateQuery: [Info['populate']] extends [never]
    ? M
    : M & {
        [defaultsKey]: Record<Info['populate'], true>;
      };
  primaryKey: string;
  options: Relations[K]['options'];
};

export type RelationScopeOrTable<Relation extends RelationThunkBase> =
  Relation['options']['scope'] extends (q: Query) => Query
    ? ReturnType<Relation['options']['scope']>
    : DbTable<ReturnType<Relation['fn']>>;

export type RelationInfo<
  T extends Table = Table,
  Relations extends RelationThunks = RelationThunks,
  Relation extends RelationThunk = RelationThunk,
> = Relation extends BelongsTo
  ? BelongsToInfo<T, Relation>
  : Relation extends HasOne
  ? HasOneInfo<T, Relations, Relation>
  : Relation extends HasMany
  ? HasManyInfo<T, Relations, Relation>
  : Relation extends HasAndBelongsToMany
  ? HasAndBelongsToManyInfo<T, Relation>
  : never;

export type MapRelation<
  T extends Table,
  Relations extends RelationThunks,
  RelationName extends keyof Relations,
  Relation extends RelationThunk = Relations[RelationName],
  RelatedQuery extends Query = RelationScopeOrTable<Relation>,
  Info extends {
    params: Record<string, unknown>;
    populate: string;
    chainedCreate: boolean;
    chainedDelete: boolean;
  } = RelationInfo<T, Relations, Relation>,
> = RelationQuery<
  RelationName,
  Info['params'],
  Info['populate'],
  Relation['returns'] extends 'one'
    ? Relation['options']['required'] extends true
      ? SetQueryReturnsOne<RelatedQuery>
      : SetQueryReturnsOneOptional<RelatedQuery>
    : SetQueryReturnsAll<RelatedQuery>,
  Relation['options']['required'] extends boolean
    ? Relation['options']['required']
    : false,
  Info['chainedCreate'],
  Info['chainedDelete']
>;

export type MapRelations<T extends Table> = 'relations' extends keyof T
  ? T['relations'] extends RelationThunks
    ? {
        [K in keyof T['relations']]: MapRelation<T, T['relations'], K>;
      }
    : EmptyObject
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
  result: OrchidORM<TableClasses>,
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
        const throughRel = table.relations[
          through as never
        ] as unknown as BaseRelation;

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
  const query = (
    relation.options.scope
      ? relation.options.scope(otherDbTable)
      : (otherDbTable as unknown as QueryWithTable)
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
    query._take();
  }

  if (data.virtualColumn) {
    dbTable.shape[relationName] = dbTable.query.shape[relationName] =
      data.virtualColumn;
  }

  makeRelationQuery(dbTable, definedAs, relationName, data);

  (dbTable.relations as Record<string, unknown>)[relationName] = {
    type,
    key: relationName,
    table: otherDbTable,
    query,
    joinQuery: data.joinQuery,
    primaryKey: data.primaryKey,
    options: relation.options,
  };

  const tableRelations = delayedRelations.get(dbTable);
  if (!tableRelations) return;

  tableRelations[relationName]?.forEach((data) => {
    applyRelation(qb, data, delayedRelations);
  });
};

const makeRelationQuery = (
  table: Query,
  definedAs: string,
  relationName: string,
  data: RelationData,
) => {
  Object.defineProperty(table, relationName, {
    get() {
      const toTable = this.db[definedAs].as(relationName) as Query;

      if (data.returns === 'one') {
        toTable._take();
      }

      const query = this.isSubQuery
        ? toTable
        : toTable._whereExists(
            this.baseQuery,
            (q) => data.reverseJoin(this, toTable) as unknown as typeof q,
          );

      query.query[relationQueryKey] = {
        relationName,
        sourceQuery: this,
        relationQuery: toTable,
        joinQuery: data.joinQuery,
      };

      const setQuery = data.modifyRelatedQuery?.(query);
      setQuery?.(this);

      return new Proxy(data.method, {
        get(_, prop) {
          return (query as unknown as Record<string, unknown>)[prop as string];
        },
      }) as unknown as RelationQuery;
    },
  });
};
