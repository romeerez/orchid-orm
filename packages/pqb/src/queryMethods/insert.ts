import {
  AddQuerySelect,
  defaultsKey,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsVoid,
} from '../query';
import { pushQueryValue, setQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression } from '../common';
import { BelongsToRelation, Relation } from '../relations';
import { noop, SetOptional } from '../utils';

export type ReturningArg<T extends Query> = (keyof T['shape'])[] | '*';

type OptionalKeys<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K]['isPrimaryKey'] extends true
    ? K
    : T['shape'][K]['isNullable'] extends true
    ? K
    : never;
}[keyof T['shape']];

type BelongsToRelations<T extends Query> = T['relations'] extends Record<
  string,
  Relation
>
  ? {
      [K in keyof T['relations'] as T['relations'][K] extends BelongsToRelation
        ? K
        : never]: T['relations'][K] extends BelongsToRelation
        ? T['relations'][K]
        : never;
    }
  : Record<never, BelongsToRelation>;

type InsertData<
  T extends Query,
  BT extends Record<string, BelongsToRelation> = BelongsToRelations<T>,
> = Omit<
  SetOptional<SetOptional<T['type'], OptionalKeys<T>>, keyof T[defaultsKey]>,
  { [K in keyof BT]: BT[K]['options']['foreignKey'] }[keyof BT]
> &
  // eslint-disable-next-line @typescript-eslint/ban-types
  ({} extends BT
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {}
    : {
        [Key in keyof BT]:
          | {
              [K in BT[Key]['options']['foreignKey']]: BT[Key]['options']['foreignKey'] extends keyof T['type']
                ? T['type'][BT[Key]['options']['foreignKey']]
                : never;
            }
          | {
              [K in Key]: { create: InsertData<BT[Key]['model']> };
            };
      }[keyof BT]);

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

type RelationTuple = [
  relationName: string,
  rowIndex: number,
  columnIndex: number,
  data: Record<string, unknown>,
];

const processInsertItem = (
  item: Record<string, unknown>,
  rowIndex: number,
  relations: Record<string, Relation>,
  prependRelations: RelationTuple[],
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

        prependRelations.push([
          key,
          rowIndex,
          columnIndex,
          item[key] as Record<string, unknown>,
        ]);
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
    returning?: unknown,
  ) {
    const q = Array.isArray(data)
      ? (this as unknown as Query)._all()
      : (this as unknown as Query)._take();

    let columns: string[];
    const prependRelations: RelationTuple[] = [];
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
      const defaults = q.query?.defaults;

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
          columns,
          columnsMap,
        );

        values = [columns.map((key) => (data as Record<string, unknown>)[key])];
      }
    }

    if (prependRelations.length) {
      setQueryValue(
        q,
        'prependQueries',
        prependRelations.map(([relationName, rowIndex, columnIndex, data]) => {
          const relation = relations[relationName];
          const primaryKey = (relation as BelongsToRelation).options.primaryKey;
          if (data.create) {
            return async () => {
              const result = await relation.model.insert(
                data.create as InsertData<Query>,
                [primaryKey],
              );
              const row = (values as unknown[][])[rowIndex];
              row[columnIndex] = result[primaryKey];
            };
          }
          return noop;
        }),
      );
    }

    setQueryValue(q, 'type', 'insert');
    setQueryValue(q, 'columns', columns);
    setQueryValue(q, 'values', values);

    if (returning) {
      pushQueryValue(q, 'returning', returning);
    }

    return q as unknown as InsertOneResult<Query, ReturningArg<Query>> &
      InsertManyResult<Query, ReturningArg<Query>>;
  }

  defaults<T extends Query, Data extends Partial<InsertData<T>>>(
    this: T,
    data: Data,
  ): T & { [defaultsKey]: Data } {
    return (this.clone() as T)._defaults(data);
  }
  _defaults<T extends Query, Data extends Partial<InsertData<T>>>(
    this: T,
    data: Data,
  ): T & { [defaultsKey]: Data } {
    const q = this.toQuery();
    setQueryValue(q, 'defaults', data);
    return q as T & { [defaultsKey]: Data };
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
    const q = this.query.toQuery();
    setQueryValue(q, 'onConflict', {
      type: 'ignore',
      expr: this.onConflict,
    });
    return q;
  }

  merge(
    update?:
      | keyof T['shape']
      | (keyof T['shape'])[]
      | Partial<T['type']>
      | RawExpression,
  ): T {
    const q = this.query.toQuery();
    setQueryValue(q, 'onConflict', {
      type: 'merge',
      expr: this.onConflict,
      update,
    });
    return q;
  }
}
