import {
  defaultsKey,
  Query,
  QueryReturnsAll,
  QueryReturnType,
  queryTypeWithLimitOne,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsRowCount,
} from '../query';
import { pushQueryArray } from '../queryDataUtils';
import { RawExpression } from '../common';
import {
  BelongsToNestedInsert,
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneNestedInsert,
  HasOneRelation,
  NestedInsertItem,
  NestedInsertOneItem,
  Relation,
  RelationsBase,
} from '../relations';
import { EmptyObject, SetOptional } from '../utils';
import { InsertQueryData, OnConflictItem, OnConflictMergeUpdate } from '../sql';
import { WhereArg } from './where';
import { parseResult, queryMethodByReturnType } from './then';

export type InsertData<
  T extends Query,
  DefaultKeys extends PropertyKey = keyof T[defaultsKey],
  Data = SetOptional<T['inputType'], DefaultKeys>,
> = [keyof T['relations']] extends [never]
  ? Data
  : OmitBelongsToForeignKeys<T['relations'], Data> & InsertRelationData<T>;

type OmitBelongsToForeignKeys<R extends RelationsBase, Data> = Omit<
  Data,
  {
    [K in keyof R]: R[K] extends BelongsToRelation
      ? R[K]['options']['foreignKey']
      : never;
  }[keyof R]
>;

type InsertRelationData<T extends Query> = {
  [K in keyof T['relations']]: T['relations'][K] extends BelongsToRelation
    ? InsertBelongsToData<T, K, T['relations'][K]>
    : T['relations'][K] extends HasOneRelation
    ? InsertHasOneData<T, K, T['relations'][K]>
    : T['relations'][K] extends HasManyRelation | HasAndBelongsToManyRelation
    ? InsertHasManyData<T, K, T['relations'][K]>
    : EmptyObject;
}[keyof T['relations']];

type InsertBelongsToData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends BelongsToRelation,
> =
  | SetOptional<
      {
        [K in Rel['options']['foreignKey']]: Rel['options']['foreignKey'] extends keyof T['inputType']
          ? T['inputType'][Rel['options']['foreignKey']]
          : never;
      },
      keyof T[defaultsKey]
    >
  | {
      [K in Key]:
        | {
            create: InsertData<Rel['nestedCreateQuery']>;
            connect?: never;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect: WhereArg<Rel['model']>;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect?: never;
            connectOrCreate: {
              where: WhereArg<Rel['model']>;
              create: InsertData<Rel['nestedCreateQuery']>;
            };
          };
    };

type InsertHasOneData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends HasOneRelation,
> = 'through' extends Rel['options']
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : {
      [K in Key]?:
        | {
            create: InsertData<Rel['nestedCreateQuery']>;
            connect?: never;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect: WhereArg<Rel['model']>;
            connectOrCreate?: never;
          }
        | {
            create?: never;
            connect?: never;
            connectOrCreate: {
              where?: WhereArg<Rel['model']>;
              create?: InsertData<Rel['nestedCreateQuery']>;
            };
          };
    };

type InsertHasManyData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends HasManyRelation | HasAndBelongsToManyRelation,
> = 'through' extends Rel['options']
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : {
      [K in Key]?: {
        create?: InsertData<Rel['nestedCreateQuery']>[];
        connect?: WhereArg<Rel['model']>[];
        connectOrCreate?: {
          where: WhereArg<Rel['model']>;
          create: InsertData<Rel['nestedCreateQuery']>;
        }[];
      };
    };

type InsertRawData = { columns: string[]; values: RawExpression };

type InsertOneResult<T extends Query> = T['hasSelect'] extends true
  ? QueryReturnsAll<T['returnType']> extends true
    ? SetQueryReturnsOne<T>
    : T['returnType'] extends 'one'
    ? SetQueryReturnsOne<T>
    : T
  : SetQueryReturnsRowCount<T>;

type InsertManyResult<T extends Query> = T['hasSelect'] extends true
  ? T['returnType'] extends 'one' | 'oneOrThrow'
    ? SetQueryReturnsAll<T>
    : T
  : SetQueryReturnsRowCount<T>;

type OnConflictArg<T extends Query> =
  | keyof T['shape']
  | (keyof T['shape'])[]
  | RawExpression;

type PrependRelations = Record<
  string,
  [rowIndex: number, columnIndex: number, data: Record<string, unknown>][]
>;

type AppendRelations = Record<
  string,
  [rowIndex: number, data: NestedInsertItem][]
>;

type InsertCtx = {
  prependRelations: PrependRelations;
  appendRelations: AppendRelations;
  requiredReturning: Record<string, boolean>;
  relations: Record<string, Relation>;
};

const processInsertItem = (
  item: Record<string, unknown>,
  rowIndex: number,
  ctx: InsertCtx,
  columns: string[],
  columnsMap: Record<string, number>,
) => {
  Object.keys(item).forEach((key) => {
    if (ctx.relations[key]) {
      if (ctx.relations[key].type === 'belongsTo') {
        const foreignKey = (ctx.relations[key] as BelongsToRelation).options
          .foreignKey;

        let columnIndex = columnsMap[foreignKey];
        if (columnIndex === undefined) {
          columnsMap[foreignKey] = columnIndex = columns.length;
          columns.push(foreignKey);
        }

        if (!ctx.prependRelations[key]) ctx.prependRelations[key] = [];

        ctx.prependRelations[key].push([
          rowIndex,
          columnIndex,
          item[key] as Record<string, unknown>,
        ]);
      } else {
        ctx.requiredReturning[ctx.relations[key].primaryKey] = true;

        if (!ctx.appendRelations[key]) ctx.appendRelations[key] = [];

        ctx.appendRelations[key].push([
          rowIndex,
          item[key] as NestedInsertItem,
        ]);
      }
    } else if (columnsMap[key] === undefined) {
      columnsMap[key] = columns.length;
      columns.push(key);
    }
  });
};

const createInsertCtx = (q: Query): InsertCtx => ({
  prependRelations: {},
  appendRelations: {},
  requiredReturning: {},
  relations: (q as unknown as Query).relations,
});

const getInsertSingleReturnType = (q: Query) => {
  const { select, returnType = 'all' } = q.query;
  if (select) {
    return returnType === 'all' ? 'one' : returnType;
  } else {
    return 'rowCount';
  }
};

const getInsertManyReturnType = (q: Query) => {
  const { select, returnType } = q.query;
  if (select) {
    return returnType === 'one' || returnType === 'oneOrThrow'
      ? 'all'
      : returnType;
  } else {
    return 'rowCount';
  }
};

const handleInsertOneData = (
  q: Query,
  data: InsertData<Query>,
  ctx: InsertCtx,
) => {
  const columns: string[] = [];
  const columnsMap: Record<string, number> = {};
  const defaults = q.query.defaults;

  if (defaults) {
    data = { ...defaults, ...data };
  }

  processInsertItem(data, 0, ctx, columns, columnsMap);

  const values = [columns.map((key) => (data as Record<string, unknown>)[key])];

  return { columns, values };
};

const handleInsertManyData = (
  q: Query,
  data: InsertData<Query>[],
  ctx: InsertCtx,
) => {
  const columns: string[] = [];
  const columnsMap: Record<string, number> = {};
  const defaults = q.query.defaults;

  if (defaults) {
    data = data.map((item) => ({ ...defaults, ...item }));
  }

  data.forEach((item, i) => {
    processInsertItem(item, i, ctx, columns, columnsMap);
  });

  const values = Array(data.length);

  data.forEach((item, i) => {
    (values as unknown[][])[i] = columns.map((key) => item[key]);
  });

  return { columns, values };
};

const insert = (
  self: Query,
  {
    columns,
    values,
  }: {
    columns: string[];
    values: unknown[][] | RawExpression;
  },
  returnType: QueryReturnType,
  ctx?: InsertCtx,
  fromQuery?: Query,
) => {
  const q = self as Query & { query: InsertQueryData };
  const returning = q.query.select;

  delete q.query.and;
  delete q.query.or;

  q.query.type = 'insert';
  q.query.columns = columns;
  q.query.values = values;
  q.query.fromQuery = fromQuery;

  if (!ctx) {
    q.query.returnType = returnType;
    return q;
  }

  const prependRelationsKeys = Object.keys(ctx.prependRelations);
  if (prependRelationsKeys.length) {
    pushQueryArray(
      q,
      'beforeQuery',
      prependRelationsKeys.map((relationName) => {
        return async (q: Query) => {
          const relationData = ctx.prependRelations[relationName];
          const relation = ctx.relations[relationName];

          const inserted = await (
            relation.nestedInsert as BelongsToNestedInsert
          )(
            q,
            relationData.map(([, , data]) => data as NestedInsertOneItem),
          );

          const primaryKey = (relation as BelongsToRelation).options.primaryKey;
          relationData.forEach(([rowIndex, columnIndex], index) => {
            (values as unknown[][])[rowIndex][columnIndex] =
              inserted[index][primaryKey];
          });
        };
      }),
    );
  }

  const appendRelationsKeys = Object.keys(ctx.appendRelations);
  if (appendRelationsKeys.length) {
    if (!returning?.includes('*')) {
      const requiredColumns = Object.keys(ctx.requiredReturning);

      if (!returning) {
        q.query.select = requiredColumns;
      } else {
        q.query.select = [
          ...new Set([...(returning as string[]), ...requiredColumns]),
        ];
      }
    }

    let resultOfTypeAll: Record<string, unknown>[] | undefined;
    if (returnType !== 'all') {
      const { handleResult } = q.query;
      q.query.handleResult = async (q, queryResult) => {
        resultOfTypeAll = (await handleResult(q, queryResult)) as Record<
          string,
          unknown
        >[];

        if (queryMethodByReturnType[returnType] === 'arrays') {
          queryResult.rows.forEach(
            (row, i) =>
              ((queryResult.rows as unknown as unknown[][])[i] =
                Object.values(row)),
          );
        }

        return parseResult(q, returnType, queryResult);
      };
    }

    pushQueryArray(
      q,
      'afterQuery',
      appendRelationsKeys.map((relationName) => {
        return (q: Query, result: Record<string, unknown>[]) => {
          const all = resultOfTypeAll || result;
          return (
            ctx.relations[relationName].nestedInsert as HasOneNestedInsert
          )?.(
            q,
            ctx.appendRelations[relationName].map(([rowIndex, data]) => [
              all[rowIndex],
              data as NestedInsertOneItem,
            ]),
          );
        };
      }),
    );
  }

  if (prependRelationsKeys.length || appendRelationsKeys.length) {
    q.query.wrapInTransaction = true;
  }

  q.query.returnType = appendRelationsKeys.length ? 'all' : returnType;

  return q;
};

export class Insert {
  insert<T extends Query>(this: T, data: InsertData<T>): InsertOneResult<T> {
    return this.clone()._insert(data);
  }
  _insert<T extends Query>(this: T, data: InsertData<T>): InsertOneResult<T> {
    const ctx = createInsertCtx(this);
    return insert(
      this,
      handleInsertOneData(this, data, ctx),
      getInsertSingleReturnType(this),
      ctx,
    ) as InsertOneResult<T>;
  }

  insertMany<T extends Query>(
    this: T,
    data: InsertData<T>[],
  ): InsertManyResult<T> {
    return this.clone()._insertMany(data);
  }
  _insertMany<T extends Query>(
    this: T,
    data: InsertData<T>[],
  ): InsertManyResult<T> {
    const ctx = createInsertCtx(this);
    return insert(
      this,
      handleInsertManyData(this, data, ctx),
      getInsertManyReturnType(this),
      ctx,
    ) as InsertManyResult<T>;
  }

  insertRaw<T extends Query>(
    this: T,
    data: InsertRawData,
  ): InsertManyResult<T> {
    return this.clone()._insertRaw(data);
  }
  _insertRaw<T extends Query>(
    this: T,
    data: InsertRawData,
  ): InsertManyResult<T> {
    return insert(
      this,
      data,
      getInsertManyReturnType(this),
    ) as InsertManyResult<T>;
  }

  create<T extends Query>(this: T, data: InsertData<T>): SetQueryReturnsOne<T> {
    return this.clone()._create(data);
  }
  _create<T extends Query>(
    this: T,
    data: InsertData<T>,
  ): SetQueryReturnsOne<T> {
    if (!this.query.select) {
      this.query.select = ['*'];
    }
    return this.clone()._insert(data) as SetQueryReturnsOne<T>;
  }

  createMany<T extends Query>(
    this: T,
    data: InsertData<T>[],
  ): SetQueryReturnsAll<T> {
    return this.clone()._createMany(data);
  }
  _createMany<T extends Query>(
    this: T,
    data: InsertData<T>[],
  ): SetQueryReturnsAll<T> {
    if (!this.query.select) {
      this.query.select = ['*'];
    }
    return this.clone()._insertMany(data) as SetQueryReturnsAll<T>;
  }

  createRaw<T extends Query>(
    this: T,
    data: InsertRawData,
  ): SetQueryReturnsAll<T> {
    return this.clone()._createRaw(data);
  }
  _createRaw<T extends Query>(
    this: T,
    data: InsertRawData,
  ): SetQueryReturnsAll<T> {
    if (!this.query.select) {
      this.query.select = ['*'];
    }
    return this.clone()._insertRaw(data) as SetQueryReturnsAll<T>;
  }

  createFrom<
    T extends Query,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data: Omit<InsertData<T>, keyof Q['result']>,
  ): SetQueryReturnsOne<T> {
    return this.clone()._createFrom(query, data);
  }
  _createFrom<
    T extends Query,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data: Omit<InsertData<T>, keyof Q['result']>,
  ): SetQueryReturnsOne<T> {
    if (!queryTypeWithLimitOne[query.query.returnType]) {
      throw new Error(
        'createFrom accepts only a query which returns one record',
      );
    }

    if (!this.query.select) {
      this.query.select = ['*'];
    }

    const ctx = createInsertCtx(this);

    const queryColumns: string[] = [];
    query.query.select?.forEach((item) => {
      if (typeof item === 'string') {
        const index = item.indexOf('.');
        queryColumns.push(index === -1 ? item : item.slice(index + 1));
      } else if ('selectAs' in item) {
        queryColumns.push(...Object.keys(item.selectAs));
      }
    });

    const { columns, values } = handleInsertOneData(this, data, ctx);
    queryColumns.push(...columns);

    return insert(
      this,
      { columns: queryColumns, values },
      'one',
      ctx,
      query,
    ) as SetQueryReturnsOne<T>;
  }

  defaults<T extends Query, Data extends Partial<InsertData<T>>>(
    this: T,
    data: Data,
  ): T & {
    [defaultsKey]: Record<keyof Data, true>;
  } {
    return (this.clone() as T)._defaults(data);
  }
  _defaults<T extends Query, Data extends Partial<InsertData<T>>>(
    this: T,
    data: Data,
  ): T & { [defaultsKey]: Record<keyof Data, true> } {
    this.query.defaults = data;
    return this as T & { [defaultsKey]: Record<keyof Data, true> };
  }

  onConflict<T extends Query, Arg extends OnConflictArg<T>>(
    this: T,
    arg?: Arg,
  ): OnConflictQueryBuilder<T, Arg> {
    return this.clone()._onConflict(arg);
  }
  _onConflict<
    T extends Query,
    Arg extends OnConflictArg<T> | undefined = undefined,
  >(this: T, arg?: Arg): OnConflictQueryBuilder<T, Arg> {
    return new OnConflictQueryBuilder(this, arg as Arg);
  }
}

export class OnConflictQueryBuilder<
  T extends Query,
  Arg extends OnConflictArg<T> | undefined,
> {
  constructor(private query: T, private onConflict: Arg) {}

  ignore(): T {
    (this.query.query as InsertQueryData).onConflict = {
      type: 'ignore',
      expr: this.onConflict as OnConflictItem,
    };
    return this.query;
  }

  merge(
    update?:
      | keyof T['shape']
      | (keyof T['shape'])[]
      | Partial<T['inputType']>
      | RawExpression,
  ): T {
    (this.query.query as InsertQueryData).onConflict = {
      type: 'merge',
      expr: this.onConflict as OnConflictItem,
      update: update as OnConflictMergeUpdate,
    };
    return this.query;
  }
}
