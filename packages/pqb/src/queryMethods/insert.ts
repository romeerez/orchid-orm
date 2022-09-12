import {
  AddQuerySelect,
  defaultsKey,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsVoid,
} from '../query';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression } from '../common';
import {
  BelongsToNestedInsert,
  BelongsToRelation,
  HasOneNestedInsert,
  HasOneRelation,
  NestedInsertItem,
  NestedInsertOneItem,
  Relation,
} from '../relations';
import { SetOptional } from '../utils';
import { InsertQueryData, OnConflictItem, OnConflictMergeUpdate } from '../sql';

export type ReturningArg<T extends Query> = (keyof T['shape'])[] | '*';

export type OptionalKeys<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K]['isPrimaryKey'] extends true
    ? K
    : T['shape'][K]['isNullable'] extends true
    ? K
    : never;
}[keyof T['shape']];

export type InsertData<
  T extends Query,
  DefaultKeys extends string = T[defaultsKey] extends string
    ? T[defaultsKey]
    : never,
  Data = SetOptional<SetOptional<T['type'], OptionalKeys<T>>, DefaultKeys>,
> = [keyof T['relations']] extends [never]
  ? Data
  : Omit<
      Data,
      {
        [K in keyof T['relations']]: T['relations'][K] extends BelongsToRelation
          ? T['relations'][K]['options']['foreignKey']
          : never;
      }[keyof T['relations']]
    > &
      {
        [Key in keyof T['relations']]: T['relations'][Key] extends BelongsToRelation
          ?
              | SetOptional<
                  {
                    [K in T['relations'][Key]['options']['foreignKey']]: T['relations'][Key]['options']['foreignKey'] extends keyof T['type']
                      ? T['type'][T['relations'][Key]['options']['foreignKey']]
                      : never;
                  },
                  DefaultKeys
                >
              | {
                  [K in Key]: {
                    create: InsertData<
                      T['relations'][Key]['nestedCreateQuery']
                    >;
                  };
                }
          : T['relations'][Key] extends HasOneRelation
          ? 'through' extends T['relations'][Key]['options']
            ? // eslint-disable-next-line @typescript-eslint/ban-types
              {}
            : {
                [K in Key]?: {
                  create: InsertData<T['relations'][Key]['nestedCreateQuery']>;
                };
              }
          : T['relations'][Key] extends Relation
          ? 'through' extends T['relations'][Key]['options']
            ? // eslint-disable-next-line @typescript-eslint/ban-types
              {}
            : {
                [K in Key]?: {
                  create: InsertData<
                    T['relations'][Key]['nestedCreateQuery']
                  >[];
                };
              }
          : // eslint-disable-next-line @typescript-eslint/ban-types
            {};
      }[keyof T['relations']];

type InsertOneResult<
  T extends Query,
  Returning extends ReturningArg<T> | undefined,
> = Returning extends ReturningArg<T>
  ? Returning extends '*'
    ? SetQueryReturnsOne<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsOne<AddQuerySelect<T, Pick<T['shape'], Returning[number]>>>
  : SetQueryReturnsVoid<T>;

type InsertManyResult<
  T extends Query,
  Returning extends ReturningArg<T> | undefined,
> = Returning extends ReturningArg<T>
  ? Returning extends '*'
    ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Returning[number]>>>
  : SetQueryReturnsVoid<T>;

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

type BeforeInsertCallback<T extends Query> = (arg: {
  query: T;
}) => void | Promise<void>;

type AfterInsertCallback<T extends Query> = (arg: {
  query: T;
  data: unknown;
}) => void | Promise<void>;

const processInsertItem = (
  item: Record<string, unknown>,
  rowIndex: number,
  relations: Record<string, Relation>,
  prependRelations: PrependRelations,
  appendRelations: AppendRelations,
  requiredReturning: Record<string, boolean>,
  columns: string[],
  columnsMap: Record<string, number>,
) => {
  Object.keys(item).forEach((key) => {
    if (relations[key]) {
      if (relations[key].type === 'belongsTo') {
        const foreignKey = (relations[key] as BelongsToRelation).options
          .foreignKey;

        let columnIndex = columnsMap[foreignKey];
        if (columnIndex === undefined) {
          columnsMap[foreignKey] = columnIndex = columns.length;
          columns.push(foreignKey);
        }

        if (!prependRelations[key]) prependRelations[key] = [];

        prependRelations[key].push([
          rowIndex,
          columnIndex,
          item[key] as Record<string, unknown>,
        ]);
      } else {
        requiredReturning[relations[key].primaryKey] = true;

        if (!appendRelations[key]) appendRelations[key] = [];

        appendRelations[key].push([rowIndex, item[key] as NestedInsertItem]);
      }
    } else if (columnsMap[key] === undefined) {
      columnsMap[key] = columns.length;
      columns.push(key);
    }
  });
};

export class Insert {
  insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>,
    returning?: Returning,
  ): InsertOneResult<T, Returning>;
  insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>[] | { columns: string[]; values: RawExpression },
    returning?: Returning,
  ): InsertManyResult<T, Returning>;
  insert(
    this: Query,
    data: InsertData<Query> & InsertData<Query>[],
    returning?: ReturningArg<Query>,
  ) {
    return this.clone()._insert(data, returning) as unknown as InsertOneResult<
      Query,
      ReturningArg<Query>
    > &
      InsertManyResult<Query, ReturningArg<Query>>;
  }

  _insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>,
    returning?: Returning,
  ): InsertOneResult<T, Returning>;
  _insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>[] | { columns: string[]; values: RawExpression },
    returning?: Returning,
  ): InsertManyResult<T, Returning>;
  _insert(
    data:
      | Record<string, unknown>
      | Record<string, unknown>[]
      | { columns: string[]; values: RawExpression },
    returning?: ReturningArg<Query>,
  ) {
    const q = this as unknown as Query & { query: InsertQueryData };
    delete q.query.and;
    delete q.query.or;

    let columns: string[];
    const prependRelations: PrependRelations = {};
    const appendRelations: AppendRelations = {};
    const requiredReturning: Record<string, boolean> = {};
    const relations = (this as unknown as Query).relations as unknown as Record<
      string,
      Relation
    >;
    let values: unknown[][] | RawExpression;

    if (
      'values' in data &&
      typeof data.values === 'object' &&
      data.values &&
      isRaw(data.values)
    ) {
      columns = (data as { columns: string[] }).columns;
      values = data.values;
    } else {
      columns = [];
      const columnsMap: Record<string, number> = {};
      const defaults = q.query.defaults;

      if (Array.isArray(data)) {
        if (defaults) {
          data = data.map((item) => ({ ...defaults, ...item }));
        }

        data.forEach((item, i) => {
          processInsertItem(
            item,
            i,
            relations,
            prependRelations,
            appendRelations,
            requiredReturning,
            columns,
            columnsMap,
          );
        });

        values = Array(data.length);

        data.forEach((item, i) => {
          (values as unknown[][])[i] = columns.map((key) => item[key]);
        });
      } else {
        if (defaults) {
          data = { ...defaults, ...data };
        }

        processInsertItem(
          data,
          0,
          relations,
          prependRelations,
          appendRelations,
          requiredReturning,
          columns,
          columnsMap,
        );

        values = [columns.map((key) => (data as Record<string, unknown>)[key])];
      }
    }

    const prependRelationsKeys = Object.keys(prependRelations);
    if (prependRelationsKeys.length) {
      pushQueryArray(
        q,
        'beforeQuery',
        prependRelationsKeys.map((relationName) => {
          return async (q: Query) => {
            const relationData = prependRelations[relationName];
            const relation = relations[relationName];

            const inserted = await (
              relation.nestedInsert as BelongsToNestedInsert
            )(
              q,
              relationData.map(([, , data]) => data as NestedInsertOneItem),
            );

            const primaryKey = (relation as BelongsToRelation).options
              .primaryKey;
            relationData.forEach(([rowIndex, columnIndex], index) => {
              (values as unknown[][])[rowIndex][columnIndex] =
                inserted[index][primaryKey];
            });
          };
        }),
      );
    }

    const appendRelationsKeys = Object.keys(appendRelations);
    if (appendRelationsKeys.length) {
      if (returning !== '*') {
        const requiredColumns = Object.keys(requiredReturning);

        if (!returning) {
          returning = requiredColumns;
        } else {
          returning = [
            ...new Set([...(returning as string[]), ...requiredColumns]),
          ];
        }
      }

      pushQueryArray(
        q,
        'afterQuery',
        appendRelationsKeys.map((relationName) => {
          return async (q: Query, result: unknown) => {
            const all = (q.returnType === 'all' ? result : [result]) as Record<
              string,
              unknown
            >[];

            await (
              relations[relationName].nestedInsert as HasOneNestedInsert
            )?.(
              q,
              appendRelations[relationName].map(([rowIndex, data]) => [
                all[rowIndex],
                data as NestedInsertOneItem,
              ]),
            );
          };
        }),
      );
    }

    q.query.type = 'insert';
    q.query.columns = columns;
    q.query.values = values;
    if (prependRelationsKeys.length || appendRelationsKeys.length) {
      q.query.wrapInTransaction = true;
    }

    if (returning) {
      q.returnType = Array.isArray(data) ? 'all' : 'one';
      pushQueryValue(q, 'returning', returning);
    } else {
      q.returnType = 'rowCount';
    }

    return q as unknown as InsertOneResult<Query, ReturningArg<Query>> &
      InsertManyResult<Query, ReturningArg<Query>>;
  }

  defaults<T extends Query, Data extends Partial<InsertData<T>>>(
    this: T,
    data: Data,
  ): T & { [defaultsKey]: keyof Data } {
    return (this.clone() as T)._defaults(data);
  }
  _defaults<T extends Query, Data extends Partial<InsertData<T>>>(
    this: T,
    data: Data,
  ): T & { [defaultsKey]: keyof Data } {
    this.query.defaults = data;
    return this as T & { [defaultsKey]: keyof Data };
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

  beforeInsert<T extends Query>(this: T, cb: BeforeInsertCallback<T>): T {
    return this.clone()._beforeInsert(cb);
  }
  _beforeInsert<T extends Query>(this: T, cb: BeforeInsertCallback<T>): T {
    return pushQueryValue(this, 'beforeInsert', cb);
  }

  afterInsert<T extends Query>(this: T, cb: AfterInsertCallback<T>): T {
    return this.clone()._afterInsert(cb);
  }
  _afterInsert<T extends Query>(this: T, cb: AfterInsertCallback<T>): T {
    return pushQueryValue(this, 'afterInsert', cb);
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
      | Partial<T['type']>
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
