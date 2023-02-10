import {
  defaultsKey,
  Query,
  QueryReturnsAll,
  QueryReturnType,
  queryTypeWithLimitOne,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
} from '../query';
import {
  BelongsToRelation,
  HasAndBelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  RelationsBase,
} from '../relations';
import { EmptyObject, SetOptional } from '../utils';
import { InsertQueryData, OnConflictItem, OnConflictMergeUpdate } from '../sql';
import { WhereArg } from './where';
import { parseResult, queryMethodByReturnType } from './then';
import { NotFoundError } from '../errors';
import { RawExpression } from '../raw';
import { VirtualColumn } from '../columns';
import { anyShape } from '../db';

export type CreateData<
  T extends Query,
  DefaultKeys extends PropertyKey = keyof T[defaultsKey],
  Data = SetOptional<T['inputType'], DefaultKeys>,
> = [keyof T['relations']] extends [never]
  ? Data
  : OmitBelongsToForeignKeys<T['relations'], Data> & CreateRelationData<T>;

type OmitBelongsToForeignKeys<R extends RelationsBase, Data> = Omit<
  Data,
  {
    [K in keyof R]: R[K] extends BelongsToRelation
      ? R[K]['options']['foreignKey']
      : never;
  }[keyof R]
>;

type CreateRelationData<T extends Query> = {
  [K in keyof T['relations']]: T['relations'][K] extends BelongsToRelation
    ? CreateBelongsToData<T, K, T['relations'][K]>
    : T['relations'][K] extends HasOneRelation
    ? CreateHasOneData<T, K, T['relations'][K]>
    : T['relations'][K] extends HasManyRelation | HasAndBelongsToManyRelation
    ? CreateHasManyData<T, K, T['relations'][K]>
    : EmptyObject;
}[keyof T['relations']];

type CreateBelongsToData<
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
    };

type CreateHasOneData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends HasOneRelation,
> = 'through' extends Rel['options']
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : {
      [K in Key]?:
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
              where?: WhereArg<Rel['table']>;
              create?: CreateData<Rel['nestedCreateQuery']>;
            };
          };
    };

type CreateHasManyData<
  T extends Query,
  Key extends keyof T['relations'],
  Rel extends HasManyRelation | HasAndBelongsToManyRelation,
> = 'through' extends Rel['options']
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : {
      [K in Key]?: {
        create?: CreateData<Rel['nestedCreateQuery']>[];
        connect?: WhereArg<Rel['table']>[];
        connectOrCreate?: {
          where: WhereArg<Rel['table']>;
          create: CreateData<Rel['nestedCreateQuery']>;
        }[];
      };
    };

type CreateResult<T extends Query> = T extends { isCount: true }
  ? T
  : QueryReturnsAll<T['returnType']> extends true
  ? SetQueryReturnsOne<T>
  : T;

type CreateManyResult<T extends Query> = T extends { isCount: true }
  ? T
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAll<T>
  : T;

type CreateRawData = { columns: string[]; values: RawExpression };

type OnConflictArg<T extends Query> =
  | keyof T['shape']
  | (keyof T['shape'])[]
  | RawExpression;

export type CreateCtx = {
  requiredReturning: Record<string, boolean>;
  columns: Map<string, number>;
  returnTypeAll?: true;
  resultAll: Record<string, unknown>[];
};

type Encoder = (input: unknown) => unknown;

const handleSelect = (q: Query) => {
  const select = q.query.select?.[0];
  const isCount =
    typeof select === 'object' &&
    'function' in select &&
    select.function === 'count';

  if (isCount) {
    q.query.select = undefined;
  } else if (isCount || !q.query.select) {
    q.query.select = ['*'];
  }
};

const processCreateItem = (
  q: Query,
  item: Record<string, unknown>,
  rowIndex: number,
  ctx: CreateCtx,
  encoders: Record<string, Encoder>,
) => {
  const { shape } = q;
  Object.keys(item).forEach((key) => {
    if (shape[key] instanceof VirtualColumn) {
      (shape[key] as VirtualColumn).create?.(q, ctx, item, rowIndex);
    } else if (!ctx.columns.has(key) && (shape[key] || shape === anyShape)) {
      ctx.columns.set(key, ctx.columns.size);
      encoders[key] = shape[key]?.encodeFn as Encoder;
    }
  });
};

const createCtx = (): CreateCtx => ({
  requiredReturning: {},
  columns: new Map(),
  resultAll: undefined as unknown as Record<string, unknown>[],
});

const getSingleReturnType = (q: Query) => {
  const { select, returnType = 'all' } = q.query;
  if (select) {
    return returnType === 'all' ? 'one' : returnType;
  } else {
    return 'rowCount';
  }
};

const getManyReturnType = (q: Query) => {
  const { select, returnType } = q.query;
  if (select) {
    return returnType === 'one' || returnType === 'oneOrThrow'
      ? 'all'
      : returnType;
  } else {
    return 'rowCount';
  }
};

const mapColumnValues = (
  columns: string[],
  encoders: Record<string, Encoder>,
  data: Record<string, unknown>,
) => {
  return columns.map((key) =>
    encoders[key] ? encoders[key](data[key]) : data[key],
  );
};

const handleOneData = (q: Query, data: CreateData<Query>, ctx: CreateCtx) => {
  const encoders: Record<string, Encoder> = {};
  const defaults = q.query.defaults;

  if (defaults) {
    data = { ...defaults, ...data };
  }

  processCreateItem(q, data, 0, ctx, encoders);

  const columns = Array.from(ctx.columns.keys());
  const values = [mapColumnValues(columns, encoders, data)];

  return { columns, values };
};

const handleManyData = (
  q: Query,
  data: CreateData<Query>[],
  ctx: CreateCtx,
) => {
  const encoders: Record<string, Encoder> = {};
  const defaults = q.query.defaults;

  if (defaults) {
    data = data.map((item) => ({ ...defaults, ...item }));
  }

  data.forEach((item, i) => {
    processCreateItem(q, item, i, ctx, encoders);
  });

  const values = Array(data.length);
  const columns = Array.from(ctx.columns.keys());

  data.forEach((item, i) => {
    (values as unknown[][])[i] = mapColumnValues(columns, encoders, item);
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
  ctx?: CreateCtx,
) => {
  const q = self as Query & { query: InsertQueryData };
  const returning = q.query.select;

  delete q.query.and;
  delete q.query.or;

  q.query.type = 'insert';
  q.query.columns = columns;
  q.query.values = values;

  if (!ctx) {
    q.query.returnType = returnType;
    return q;
  }

  if (
    returnType === 'oneOrThrow' ||
    q.query.fromQuery?.query.returnType === 'oneOrThrow'
  ) {
    const { handleResult } = q.query;
    q.query.handleResult = async (q, r) => {
      if (r.rowCount === 0) {
        throw new NotFoundError();
      }
      return await handleResult(q, r);
    };
  }

  const requiredColumns = Object.keys(ctx.requiredReturning);
  if (requiredColumns.length && !returning?.includes('*')) {
    if (!returning) {
      q.query.select = requiredColumns;
    } else {
      q.query.select = [
        ...new Set([...(returning as string[]), ...requiredColumns]),
      ];
    }
  }

  if (ctx.returnTypeAll) {
    q.query.returnType = 'all';
    const { handleResult } = q.query;
    q.query.handleResult = async (q, queryResult) => {
      ctx.resultAll = (await handleResult(q, queryResult)) as Record<
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
  } else {
    q.query.returnType = returnType;
  }

  return q;
};

export type CreateMethodsNames =
  | 'create'
  | '_create'
  | 'createMany'
  | '_createMany'
  | 'createRaw'
  | '_createRaw'
  | 'createFrom'
  | '_createFrom';

export class Create {
  create<T extends Query>(this: T, data: CreateData<T>): CreateResult<T> {
    return this.clone()._create(data);
  }
  _create<T extends Query>(this: T, data: CreateData<T>): CreateResult<T> {
    handleSelect(this);

    const ctx = createCtx();

    const obj = handleOneData(this, data, ctx);
    let { columns } = obj;

    const { fromQuery } = this.query as InsertQueryData;
    if (fromQuery) {
      if (!queryTypeWithLimitOne[fromQuery.query.returnType]) {
        throw new Error(
          'Cannot create based on a query which returns multiple records',
        );
      }

      const queryColumns: string[] = [];
      fromQuery.query.select?.forEach((item) => {
        if (typeof item === 'string') {
          const index = item.indexOf('.');
          queryColumns.push(index === -1 ? item : item.slice(index + 1));
        } else if ('selectAs' in item) {
          queryColumns.push(...Object.keys(item.selectAs));
        }
      });

      queryColumns.push(...columns);
      columns = queryColumns;
    }

    return insert(
      this,
      { columns, values: obj.values },
      getSingleReturnType(this),
      ctx,
    ) as CreateResult<T>;
  }

  createMany<T extends Query>(
    this: T,
    data: CreateData<T>[],
  ): CreateManyResult<T> {
    return this.clone()._createMany(data);
  }
  _createMany<T extends Query>(
    this: T,
    data: CreateData<T>[],
  ): CreateManyResult<T> {
    handleSelect(this);
    const ctx = createCtx();
    return insert(
      this,
      handleManyData(this, data, ctx),
      getManyReturnType(this),
      ctx,
    ) as CreateManyResult<T>;
  }

  createRaw<T extends Query>(
    this: T,
    data: CreateRawData,
  ): CreateManyResult<T> {
    return this.clone()._createRaw(data);
  }
  _createRaw<T extends Query>(
    this: T,
    data: CreateRawData,
  ): CreateManyResult<T> {
    handleSelect(this);
    return insert(this, data, getManyReturnType(this)) as CreateManyResult<T>;
  }

  createFrom<
    T extends Query,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data: Omit<CreateData<T>, keyof Q['result']>,
  ): SetQueryReturnsOne<T> {
    return this.clone()._createFrom(query, data);
  }
  _createFrom<
    T extends Query,
    Q extends Query & { returnType: 'one' | 'oneOrThrow' },
  >(
    this: T,
    query: Q,
    data: Omit<CreateData<T>, keyof Q['result']>,
  ): CreateResult<T> {
    (this.query as InsertQueryData).fromQuery = query;
    return this._create(data as CreateData<T>);
  }

  defaults<T extends Query, Data extends Partial<CreateData<T>>>(
    this: T,
    data: Data,
  ): T & {
    [defaultsKey]: Record<keyof Data, true>;
  } {
    return (this.clone() as T)._defaults(data);
  }
  _defaults<T extends Query, Data extends Partial<CreateData<T>>>(
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
